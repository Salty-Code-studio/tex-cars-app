# Admin Password Reset (forgot password) — Design

Date: 2026-08-17 · Status: approved by Mo (chat) · Target: before go-live

## Problem

Admin users (owner, future managers) have no way to recover a forgotten
password. Today the only fallback is the `admin:create` CLI, which requires
developer access. This must exist before the platform goes live.

## Decision summary (approved)

One token mechanism, two delivery paths:

1. **Self-service email path**: "Forgot password?" on the login page emails a
   reset link. Works as soon as Resend is configured; until then the send is
   logged as `skipped` (existing `sendAndLog` behavior) and the UI copy tells
   the user to contact the owner if no email arrives.
2. **Owner path (no email needed)**: the owner generates a reset link for a
   team member from the admin shell and shares it out-of-band (WhatsApp).
   Available from day one regardless of email status.

Both paths mint the same token and land on the same reset page.

## Data model

New table `admin_reset_tokens` (new schema file
`src/lib/db/schema/admin-reset-tokens.ts`, new migration):

| column        | type            | notes                                  |
|---------------|-----------------|----------------------------------------|
| id            | uuid pk         | defaultRandom                          |
| admin_user_id | uuid fk→admin_users.id | not null, indexed              |
| token_hash    | text            | sha256 of the 32-byte url-safe token   |
| expires_at    | timestamptz     | now + 30 min                           |
| used_at       | timestamptz     | null until consumed                    |
| created_at    | timestamptz     | defaultNow                             |

Rules (mirrors `login_tokens` semantics):
- Only the hash is stored; the raw token exists once, in the link.
- Single-use: `used_at` set atomically on consume.
- Issuing a new token invalidates (marks used) all prior unused tokens for
  that admin.
- Raw token: 32 random bytes, base64url. Compare by sha256, constant-time.

## Service module

`src/lib/auth/admin-reset.ts`:

- `requestReset(email)` → always resolves (anti-enumeration). If the email
  matches an admin, mint token + send email via `sendAndLog` with a dash-free
  template (reset link to `APP_ORIGIN/admin/reset-password?token=...`).
- `mintResetLink(adminUserId)` → for the owner path; returns the raw link.
- `confirmReset(rawToken, newPassword)` → validate token (exists, unused,
  unexpired), validate password with the existing `passwordSchema` (min 12),
  then in one transaction: update `password_hash` (Argon2id via
  `hashPassword`), mark token used, **revoke all sessions for that admin**,
  clear login-lockout counters (`failed_attempts`, `locked_until`, and the
  MFA lockout fields). MFA enrollment and TOTP secret are NOT touched.

## Routes

| route | method | guard | behavior |
|---|---|---|---|
| `/api/admin/auth/reset/request` | POST | public, rate-limited (per client + per email), zod `{email}` | always `{ ok: true }` |
| `/api/admin/auth/reset/confirm` | POST | public, rate-limited, zod `{token, password}` | 200 on success, 400 invalid/expired token, 422 weak password |
| `/api/admin/users/[id]/reset-link` | POST | `requireAdmin` (owner role) + CSRF | `{ url }`, shown once; audited |

Audit entries: `admin.password_reset_requested` (on real match only),
`admin.password_reset_link_minted` (owner path, actor = owner),
`admin.password_reset_completed`.

## UI

- Login page: "Forgot password?" link under the form.
- `/admin/(auth)/forgot-password/page.tsx`: email form → always the neutral
  confirmation copy.
- `/admin/(auth)/reset-password/page.tsx`: reads `?token=`, new password +
  confirm fields, posts to confirm route, then redirects to login with a
  success notice.
- Admin shell: on the team/user view (or a minimal owner-only "Team" panel if
  none exists), a "Generate reset link" button per admin with a copy-to-
  clipboard one-time display.

## Security invariants

- Anti-enumeration on request (uniform response + uniform-ish timing; dummy
  work on miss follows the login route's dummy-verify pattern).
- Token never logged or stored raw; email is the only carrier.
- Sessions revoked on reset, so a reset kicks out any hijacked session.
- MFA unchanged: after reset, login still requires TOTP. A compromised inbox
  alone cannot take over an admin account. Lost-authenticator recovery stays
  recovery codes (out of scope here).
- Staff role cannot mint reset links (owner-only route guard).
- Rate limits on both public routes via `enforceRateLimit`.

## Out of scope

- Manager/staff role enablement (`requireAdmin` still denies `staff`).
- Customer flows (already passwordless).
- MFA reset / recovery-code regeneration UI.

## Testing

New `src/test/admin-reset.test.ts` in the existing suite style: request is
enumeration-safe; token single-use, expiry, prior-token invalidation; confirm
revokes sessions and clears lockouts but keeps MFA; weak password 422;
tampered token 400; owner-path route rejects non-owner + missing CSRF; email
template send logged (skipped without key). Full suite + tsc + build stay
green.
