# Admin Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Forgot-password recovery for admin users: self-service email link plus an owner-generated reset link, both landing on one reset page.

**Architecture:** A new `admin_reset_tokens` table (sha256-hashed single-use 30-min tokens) + a service module `src/lib/auth/admin-reset.ts` with three functions (`requestReset`, `mintResetLink`, `confirmReset`). Two public rate-limited routes + one owner-only route, two auth pages, one shell page. Mirrors the audited customer OTP (`login_tokens`) and login-route patterns already in the codebase.

**Tech Stack:** Next.js 15 App Router, Drizzle + Postgres (PGlite in dev/test), zod, vitest, Argon2id via existing `password.ts`, Resend via existing `sendAndLog`.

**Spec:** `docs/superpowers/specs/2026-08-17-admin-password-reset-design.md`

## Global Constraints

- Test DB: `pglite://` — tests call `await runMigrations()` in `beforeAll` (see `src/test/customer-login.test.ts`).
- NEVER run `npm run build` while `next dev` is running (clobbers `.next`).
- Email copy is dash-free and warm/human (no em-dashes anywhere in copy).
- Password rule = existing `passwordSchema` from `src/lib/schemas.ts` (min 12 chars).
- Public routes: `withRoute` + `enforceRateLimit(req, "auth", scope)` + `parseJsonBody`, same as `src/app/api/admin/auth/login/route.ts`.
- Anti-enumeration: `/reset/request` always returns `{ ok: true }`.
- MFA (`mfaSecret`, `mfaEnabled`, recovery codes) is NEVER modified by reset.
- All commits on `main` of the app repo (`app/` is its own git repo). Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Run tests with `npx vitest run <file>` (scoped) and `npx vitest run` + `npx tsc --noEmit` for gates.

---

### Task 1: Schema + migration for admin_reset_tokens

**Files:**
- Create: `src/lib/db/schema/admin-reset-tokens.ts`
- Modify: `src/lib/db/schema/index.ts` (add `export * from "./admin-reset-tokens";` alongside the existing exports)
- Create: migration via `npm run db:generate` (will be `drizzle/0014_*.sql`)
- Test: `src/test/admin-reset.test.ts` (created here, extended in Task 2)

**Interfaces:**
- Produces: `adminResetTokens` Drizzle table with columns `id, adminUserId, tokenHash, expiresAt, usedAt, createdAt`.

- [ ] **Step 1: Write the failing test**

```ts
// src/test/admin-reset.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { getDb } from "@/lib/db/client";
import { adminResetTokens } from "@/lib/db/schema";

beforeAll(async () => { await runMigrations(); });

describe("admin_reset_tokens schema", () => {
  it("inserts and reads a token row", async () => {
    const db = await getDb();
    // need a real admin row for the FK
    const { adminUsers } = await import("@/lib/db/schema");
    const [admin] = await db.insert(adminUsers).values({
      email: "reset-schema@test.com",
      passwordHash: "x",
    }).returning();
    const [row] = await db.insert(adminResetTokens).values({
      adminUserId: admin.id,
      tokenHash: "abc",
      expiresAt: new Date(Date.now() + 60_000),
    }).returning();
    expect(row.usedAt).toBeNull();
    expect(row.adminUserId).toBe(admin.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/admin-reset.test.ts`
Expected: FAIL (adminResetTokens is not exported / table missing).

- [ ] **Step 3: Write schema + generate migration**

```ts
// src/lib/db/schema/admin-reset-tokens.ts
import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { adminUsers } from "./admin";

/**
 * Admin password reset tokens. The raw 32-byte token lives only in the reset
 * link; we store sha256(token). Single-use, 30 minute TTL, and issuing a new
 * token invalidates any prior unused ones for the same admin.
 */
export const adminResetTokens = pgTable("admin_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminUserId: uuid("admin_user_id").notNull()
    .references(() => adminUsers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("admin_reset_tokens_admin").on(t.adminUserId)]);
```

Add to `src/lib/db/schema/index.ts`: `export * from "./admin-reset-tokens";`

Run: `npm run db:generate` (accept the generated name, it becomes `drizzle/0014_<name>.sql`). Inspect the SQL: one CREATE TABLE + FK + index, nothing touching other tables.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/admin-reset.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema/admin-reset-tokens.ts src/lib/db/schema/index.ts drizzle/ src/test/admin-reset.test.ts
git commit -m "feat(auth): admin_reset_tokens table (migration 0014)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Reset service module + email template

**Files:**
- Create: `src/lib/auth/admin-reset.ts`
- Modify: `src/lib/email/templates.ts` (add `passwordResetEmail`; follow the file's existing export style and dash-free copy)
- Test: extend `src/test/admin-reset.test.ts`

**Interfaces:**
- Consumes: `adminResetTokens` (Task 1), `hashPassword` from `@/lib/auth/password`, `destroyAllForSubject` from `@/lib/auth/sessions`, `sendAndLog` from `@/lib/email/send`, `passwordSchema` (route-side only), `env.APP_ORIGIN`, `audit` from `@/lib/audit`.
- Produces (exact signatures later tasks rely on):
  - `requestReset(email: string, req?: Request): Promise<void>` (never throws on unknown email)
  - `mintResetLink(adminUserId: string): Promise<string>` (returns full URL; throws `Errors.notFound()` if admin missing)
  - `confirmReset(rawToken: string, newPassword: string): Promise<{ ok: boolean }>`
  - `RESET_TTL_MINUTES = 30`

- [ ] **Step 1: Write the failing tests** (append to `src/test/admin-reset.test.ts`)

```ts
import { requestReset, mintResetLink, confirmReset } from "@/lib/auth/admin-reset";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, resolveSession } from "@/lib/auth/sessions";
import { eq } from "drizzle-orm";

function tokenFromUrl(url: string): string {
  return new URL(url).searchParams.get("token")!;
}

async function makeAdmin(email: string) {
  const db = await getDb();
  const { adminUsers } = await import("@/lib/db/schema");
  const [admin] = await db.insert(adminUsers).values({
    email,
    passwordHash: "old-hash",
    failedAttempts: 3,
    mfaEnabled: true,
    mfaSecret: "KEEPME",
  }).returning();
  return admin;
}

describe("admin password reset service", () => {
  it("mints a link whose token confirms once and updates the password", async () => {
    const admin = await makeAdmin("svc1@test.com");
    const url = await mintResetLink(admin.id);
    expect(url).toContain("/admin/reset-password?token=");
    const r = await confirmReset(tokenFromUrl(url), "brand-new-password-123");
    expect(r.ok).toBe(true);
    const db = await getDb();
    const { adminUsers } = await import("@/lib/db/schema");
    const [after] = await db.select().from(adminUsers).where(eq(adminUsers.id, admin.id));
    expect(await verifyPassword(after.passwordHash, "brand-new-password-123")).toBe(true);
    expect(after.failedAttempts).toBe(0);
    expect(after.lockedUntil).toBeNull();
    // MFA untouched
    expect(after.mfaEnabled).toBe(true);
    expect(after.mfaSecret).toBe("KEEPME");
    // single-use
    expect((await confirmReset(tokenFromUrl(url), "another-long-password-1")).ok).toBe(false);
  });

  it("revokes all sessions on reset", async () => {
    const admin = await makeAdmin("svc2@test.com");
    const s = await createSession({ subjectType: "admin", subjectId: admin.id, mfaPending: false });
    const url = await mintResetLink(admin.id);
    await confirmReset(tokenFromUrl(url), "brand-new-password-123");
    expect(await resolveSession(s.cookieValue)).toBeNull();
  });

  it("expired and tampered tokens fail", async () => {
    const admin = await makeAdmin("svc3@test.com");
    const url = await mintResetLink(admin.id);
    const db = await getDb();
    await db.update(adminResetTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(adminResetTokens.adminUserId, admin.id));
    expect((await confirmReset(tokenFromUrl(url), "brand-new-password-123")).ok).toBe(false);
    expect((await confirmReset("not-a-real-token", "brand-new-password-123")).ok).toBe(false);
  });

  it("a new link invalidates the previous one", async () => {
    const admin = await makeAdmin("svc4@test.com");
    const first = await mintResetLink(admin.id);
    await mintResetLink(admin.id);
    expect((await confirmReset(tokenFromUrl(first), "brand-new-password-123")).ok).toBe(false);
  });

  it("requestReset resolves silently for unknown emails", async () => {
    await expect(requestReset("nobody@test.com")).resolves.toBeUndefined();
    const db = await getDb();
    const rows = await db.select().from(adminResetTokens);
    const before = rows.length;
    await requestReset("nobody@test.com");
    expect((await db.select().from(adminResetTokens)).length).toBe(before);
  });

  it("requestReset for a real admin mints a token (email logged as skipped without key)", async () => {
    const admin = await makeAdmin("svc5@test.com");
    await requestReset("SVC5@test.com"); // case-insensitive
    const db = await getDb();
    const rows = await db.select().from(adminResetTokens).where(eq(adminResetTokens.adminUserId, admin.id));
    expect(rows.length).toBe(1);
    expect(rows[0].usedAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/test/admin-reset.test.ts`
Expected: FAIL (`admin-reset` module not found).

- [ ] **Step 3: Implement the service**

```ts
// src/lib/auth/admin-reset.ts
/**
 * Admin forgot-password flow (spec: docs/superpowers/specs/
 * 2026-08-17-admin-password-reset-design.md).
 *
 * One token mechanism, two delivery paths: requestReset emails the link
 * (anti-enumeration: silent on unknown emails), mintResetLink returns it for
 * the owner to hand over out-of-band. confirmReset consumes the token,
 * rehashes the password, revokes every session and clears lockout counters.
 * MFA is deliberately untouched: a reset link alone must not defeat TOTP.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adminResetTokens, adminUsers } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { destroyAllForSubject } from "@/lib/auth/sessions";
import { sendAndLog } from "@/lib/email/send";
import { passwordResetEmail } from "@/lib/email/templates";
import { audit } from "@/lib/audit";
import { Errors } from "@/lib/http/errors";
import { env } from "@/env";

export const RESET_TTL_MINUTES = 30;

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

async function issueToken(adminUserId: string): Promise<string> {
  const db = await getDb();
  const raw = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000);
  await db.transaction(async (tx) => {
    // A new link invalidates any prior unused ones for this admin.
    await tx.update(adminResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(adminResetTokens.adminUserId, adminUserId), isNull(adminResetTokens.usedAt)));
    await tx.insert(adminResetTokens).values({
      adminUserId,
      tokenHash: hashToken(raw),
      expiresAt,
    });
  });
  return raw;
}

function resetUrl(raw: string): string {
  return `${env.APP_ORIGIN}/admin/reset-password?token=${raw}`;
}

export async function mintResetLink(adminUserId: string): Promise<string> {
  const db = await getDb();
  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, adminUserId));
  if (!admin) throw Errors.notFound();
  return resetUrl(await issueToken(adminUserId));
}

export async function requestReset(email: string, req?: Request): Promise<void> {
  const db = await getDb();
  const normalized = email.trim().toLowerCase();
  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.email, normalized));
  if (!admin) {
    // Uniform-ish timing on miss, mirroring the login route's dummy verify.
    await verifyPassword("$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "dummy");
    return;
  }
  const url = resetUrl(await issueToken(admin.id));
  await sendAndLog(passwordResetEmail(admin.email, url));
  await audit({
    actor: admin.id,
    action: "admin.password_reset_requested",
    entity: "admin_user",
    entityId: admin.id,
    req,
  });
}

export async function confirmReset(rawToken: string, newPassword: string): Promise<{ ok: boolean }> {
  const db = await getDb();
  const hash = hashToken(rawToken);
  const [row] = await db.select().from(adminResetTokens).where(eq(adminResetTokens.tokenHash, hash));
  if (!row || row.usedAt || row.expiresAt <= new Date()) return { ok: false };
  // Constant-time compare of the stored vs derived hash (defense in depth;
  // the indexed lookup above is the real filter).
  const a = Buffer.from(row.tokenHash, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false };

  const passwordHash = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    await tx.update(adminResetTokens).set({ usedAt: new Date() })
      .where(eq(adminResetTokens.id, row.id));
    await tx.update(adminUsers).set({
      passwordHash,
      failedAttempts: 0,
      lockedUntil: null,
      mfaFailedAttempts: 0,
      mfaLockedUntil: null,
    }).where(eq(adminUsers.id, row.adminUserId));
  });
  await destroyAllForSubject("admin", row.adminUserId);
  await audit({
    actor: row.adminUserId,
    action: "admin.password_reset_completed",
    entity: "admin_user",
    entityId: row.adminUserId,
  });
  return { ok: true };
}
```

Email template, added to `src/lib/email/templates.ts` following its existing helper style (reuse the file's shared layout helper if one exists; keep copy dash-free):

```ts
export function passwordResetEmail(to: string, url: string): OutboundEmail {
  return {
    to,
    type: "admin_password_reset",
    subject: "Reset your Tex Cars admin password",
    html: [
      "<p>Someone asked to reset the password for this admin account.</p>",
      `<p><a href="${url}">Choose a new password</a> (the link works for 30 minutes and can be used once).</p>`,
      "<p>If this was not you, you can ignore this email. Your password stays as it is.</p>",
    ].join("\n"),
  };
}
```

(If `templates.ts` wraps emails in a shared layout function, pass the paragraphs through it instead of raw joining. Import `OutboundEmail` from `@/lib/email/send` if not already imported.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/test/admin-reset.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/admin-reset.ts src/lib/email/templates.ts src/test/admin-reset.test.ts
git commit -m "feat(auth): admin password reset service + email template

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Public routes (request + confirm)

**Files:**
- Create: `src/app/api/admin/auth/reset/request/route.ts`
- Create: `src/app/api/admin/auth/reset/confirm/route.ts`
- Test: `src/test/admin-reset-routes.test.ts`

**Interfaces:**
- Consumes: `requestReset(email, req)`, `confirmReset(rawToken, newPassword)` from Task 2; `passwordSchema` from `@/lib/schemas`; `withRoute`, `json`, `parseJsonBody`, `enforceRateLimit`, `Errors` (same imports as the login route).
- Produces: `POST /api/admin/auth/reset/request` → always `{ ok: true }`; `POST /api/admin/auth/reset/confirm` → `{ ok: true }` or 400.

- [ ] **Step 1: Write the failing test**

Follow the existing route-test style in the suite (look at how `src/test/audit-fixes.test.ts` or the payments route tests invoke route handlers: import `{ POST }` from the route file and call it with a `new Request(...)`; PGlite migrations in `beforeAll`).

```ts
// src/test/admin-reset-routes.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { getDb } from "@/lib/db/client";
import { adminUsers, adminResetTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { POST as requestPOST } from "@/app/api/admin/auth/reset/request/route";
import { POST as confirmPOST } from "@/app/api/admin/auth/reset/confirm/route";
import { mintResetLink } from "@/lib/auth/admin-reset";

beforeAll(async () => { await runMigrations(); });

function post(url: string, body: unknown): Request {
  return new Request(`http://localhost:3000${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/auth/reset/request", () => {
  it("returns ok for unknown AND known emails (no enumeration)", async () => {
    const r1 = await requestPOST(post("/api/admin/auth/reset/request", { email: "ghost@test.com" }));
    expect(r1.status).toBe(200);
    expect(await r1.json()).toEqual({ ok: true });

    const db = await getDb();
    const [admin] = await db.insert(adminUsers).values({
      email: "route1@test.com", passwordHash: "x",
    }).returning();
    const r2 = await requestPOST(post("/api/admin/auth/reset/request", { email: "route1@test.com" }));
    expect(r2.status).toBe(200);
    expect(await r2.json()).toEqual({ ok: true });
    const rows = await db.select().from(adminResetTokens).where(eq(adminResetTokens.adminUserId, admin.id));
    expect(rows.length).toBe(1);
  });

  it("422s a malformed email", async () => {
    const r = await requestPOST(post("/api/admin/auth/reset/request", { email: "not-an-email" }));
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
});

describe("POST /api/admin/auth/reset/confirm", () => {
  it("resets with a valid token, 400s on reuse", async () => {
    const db = await getDb();
    const [admin] = await db.insert(adminUsers).values({
      email: "route2@test.com", passwordHash: "x",
    }).returning();
    const url = await mintResetLink(admin.id);
    const token = new URL(url).searchParams.get("token")!;
    const ok = await confirmPOST(post("/api/admin/auth/reset/confirm", { token, password: "a-long-enough-password-1" }));
    expect(ok.status).toBe(200);
    const reuse = await confirmPOST(post("/api/admin/auth/reset/confirm", { token, password: "a-long-enough-password-1" }));
    expect(reuse.status).toBe(400);
  });

  it("422s a short password without consuming the token", async () => {
    const db = await getDb();
    const [admin] = await db.insert(adminUsers).values({
      email: "route3@test.com", passwordHash: "x",
    }).returning();
    const url = await mintResetLink(admin.id);
    const token = new URL(url).searchParams.get("token")!;
    const weak = await confirmPOST(post("/api/admin/auth/reset/confirm", { token, password: "short" }));
    expect(weak.status).toBeGreaterThanOrEqual(400);
    // token still valid afterwards
    const ok = await confirmPOST(post("/api/admin/auth/reset/confirm", { token, password: "a-long-enough-password-1" }));
    expect(ok.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/test/admin-reset-routes.test.ts`
Expected: FAIL (route modules not found).

- [ ] **Step 3: Implement both routes**

```ts
// src/app/api/admin/auth/reset/request/route.ts
import { z } from "zod";
import { withRoute } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { parseJsonBody } from "@/lib/http/validate";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { requestReset } from "@/lib/auth/admin-reset";

export const runtime = "nodejs";

const BodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
}).strict();

/**
 * POST /api/admin/auth/reset/request — forgot password, first step.
 * ALWAYS answers { ok: true }: whether the email exists is never revealed
 * (same anti-enumeration stance as the login route). Rate limited per client
 * AND per submitted email so one address cannot be flooded from many IPs.
 */
export const POST = withRoute(async (req) => {
  const body = await parseJsonBody(req, BodySchema);
  await enforceRateLimit(req, "auth", "admin-reset-request");
  await enforceRateLimit(req, "auth", `admin-reset-request:${body.email}`);
  await requestReset(body.email, req);
  return json({ ok: true }, req);
});
```

```ts
// src/app/api/admin/auth/reset/confirm/route.ts
import { z } from "zod";
import { withRoute } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { parseJsonBody } from "@/lib/http/validate";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { Errors } from "@/lib/http/errors";
import { confirmReset } from "@/lib/auth/admin-reset";
import { passwordSchema } from "@/lib/schemas";

export const runtime = "nodejs";

const BodySchema = z.object({
  token: z.string().min(1).max(256),
  password: passwordSchema,
}).strict();

/**
 * POST /api/admin/auth/reset/confirm — sets the new password. Token errors
 * are one generic 400 (no expired vs unknown distinction: that would leak
 * token state to a brute-forcer). Weak passwords 422 in parseJsonBody BEFORE
 * the token is consumed, so a typo does not burn the link.
 */
export const POST = withRoute(async (req) => {
  await enforceRateLimit(req, "auth", "admin-reset-confirm");
  const body = await parseJsonBody(req, BodySchema);
  const result = await confirmReset(body.token, body.password);
  if (!result.ok) throw Errors.badRequest("This reset link is invalid or has expired");
  return json({ ok: true }, req);
});
```

(If `Errors.badRequest` does not exist, use the file's closest 400 helper; check `src/lib/http/errors.ts` and keep the generic message.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/test/admin-reset-routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/auth/reset src/test/admin-reset-routes.test.ts
git commit -m "feat(api): public admin password reset routes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Owner routes (list admins + mint reset link)

**Files:**
- Create: `src/app/api/admin/users/route.ts` (GET list)
- Create: `src/app/api/admin/users/[id]/reset-link/route.ts` (POST)
- Test: `src/test/admin-reset-owner.test.ts`

**Interfaces:**
- Consumes: `mintResetLink(adminUserId)` from Task 2; `read`/`mutate` from `@/lib/admin/guard` (mutate handles requireAdmin + CSRF + audit).
- Produces: `GET /api/admin/users` → `{ users: [{ id, email, role, mfaEnabled, createdAt }] }` (never password/MFA secrets); `POST /api/admin/users/[id]/reset-link` → `{ url }`.

- [ ] **Step 1: Write the failing test**

Look at an existing guarded-route test (e.g. how `src/test/admin-vehicles.test.ts` or `audit-fixes.test.ts` builds an authed admin request: session cookie + `X-CSRF-Token` header + Origin). Reuse its helper approach.

```ts
// src/test/admin-reset-owner.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { getDb } from "@/lib/db/client";
import { adminUsers } from "@/lib/db/schema";
import { createSession } from "@/lib/auth/sessions";
import { GET as usersGET } from "@/app/api/admin/users/route";
import { POST as resetLinkPOST } from "@/app/api/admin/users/[id]/reset-link/route";

beforeAll(async () => { await runMigrations(); });

async function makeAdmin(email: string, role: "owner" | "staff" = "owner") {
  const db = await getDb();
  const [admin] = await db.insert(adminUsers).values({
    email, passwordHash: "x", role, mfaEnabled: true,
  }).returning();
  return admin;
}

// Build an authed request the way the existing admin route tests do
// (session cookie + X-CSRF-Token from the created session + matching Origin).
// If the suite has a shared helper for this, use it instead of redefining.
async function authedRequest(adminId: string, url: string, method: string) {
  const s = await createSession({ subjectType: "admin", subjectId: adminId, mfaPending: false });
  return new Request(`http://localhost:3000${url}`, {
    method,
    headers: {
      origin: "http://localhost:3000",
      cookie: `sid=${s.cookieValue}; csrf=${s.csrfToken}`,
      "x-csrf-token": s.csrfToken,
    },
  });
}

describe("owner reset-link routes", () => {
  it("owner lists admins without secret fields and mints a link", async () => {
    const owner = await makeAdmin("owner-a@test.com", "owner");
    const target = await makeAdmin("mgr-a@test.com", "owner");

    const list = await usersGET(await authedRequest(owner.id, "/api/admin/users", "GET"));
    expect(list.status).toBe(200);
    const body = await list.json();
    const entry = body.users.find((u: { email: string }) => u.email === "mgr-a@test.com");
    expect(entry).toBeDefined();
    expect(entry.passwordHash).toBeUndefined();
    expect(entry.mfaSecret).toBeUndefined();

    const mint = await resetLinkPOST(
      await authedRequest(owner.id, `/api/admin/users/${target.id}/reset-link`, "POST"),
      { params: Promise.resolve({ id: target.id }) },
    );
    expect(mint.status).toBe(200);
    expect((await mint.json()).url).toContain("/admin/reset-password?token=");
  });

  it("staff cannot mint a reset link", async () => {
    const staff = await makeAdmin("staff-a@test.com", "staff");
    const target = await makeAdmin("mgr-b@test.com", "owner");
    const res = await resetLinkPOST(
      await authedRequest(staff.id, `/api/admin/users/${target.id}/reset-link`, "POST"),
      { params: Promise.resolve({ id: target.id }) },
    );
    expect([401, 403]).toContain(res.status);
  });

  it("missing CSRF header is rejected", async () => {
    const owner = await makeAdmin("owner-b@test.com", "owner");
    const target = await makeAdmin("mgr-c@test.com", "owner");
    const s = await createSession({ subjectType: "admin", subjectId: owner.id, mfaPending: false });
    const req = new Request(`http://localhost:3000/api/admin/users/${target.id}/reset-link`, {
      method: "POST",
      headers: { origin: "http://localhost:3000", cookie: `sid=${s.cookieValue}; csrf=${s.csrfToken}` },
    });
    const res = await resetLinkPOST(req, { params: Promise.resolve({ id: target.id }) });
    expect([401, 403]).toContain(res.status);
  });
});
```

Adjust the cookie names/shape in `authedRequest` to whatever the existing admin route tests actually use (check first; `SESSION_COOKIE` constant lives in `src/lib/auth/session-cookies.ts` or similar).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/test/admin-reset-owner.test.ts`
Expected: FAIL (route modules not found).

- [ ] **Step 3: Implement both routes**

```ts
// src/app/api/admin/users/route.ts
import { withRoute } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { read } from "@/lib/admin/guard";
import { getDb } from "@/lib/db/client";
import { adminUsers } from "@/lib/db/schema";

export const runtime = "nodejs";

/** GET /api/admin/users — owner-only team list. Only safe columns leave. */
export const GET = withRoute(async (req) =>
  read(req, async () => {
    const db = await getDb();
    const rows = await db.select({
      id: adminUsers.id,
      email: adminUsers.email,
      role: adminUsers.role,
      mfaEnabled: adminUsers.mfaEnabled,
      createdAt: adminUsers.createdAt,
    }).from(adminUsers);
    return json({ users: rows }, req);
  }),
);
```

```ts
// src/app/api/admin/users/[id]/reset-link/route.ts
import { z } from "zod";
import { withRoute } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { mutate } from "@/lib/admin/guard";
import { mintResetLink } from "@/lib/auth/admin-reset";

export const runtime = "nodejs";

const ParamsSchema = z.object({ id: z.string().uuid() });

/**
 * POST /api/admin/users/[id]/reset-link — owner mints a one-time reset link
 * to hand to a team member out-of-band (WhatsApp). The link is returned ONCE
 * and never stored raw; audit records who minted for whom.
 */
export const POST = withRoute(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = ParamsSchema.parse(await ctx.params);
  return mutate(req, "admin.password_reset_link_minted", async () => {
    const url = await mintResetLink(id);
    return {
      result: json({ url }, req),
      entity: "admin_user",
      entityId: id,
    };
  });
});
```

Check how existing `[id]` routes in `src/app/api/admin/` type their second argument and whether `withRoute` passes it through; mirror that exactly. `requireAdmin`'s default already denies `staff` (owner-only) per the audit-fixes hardening; verify with the staff test, and if a `roles` option is required pass the same option the other admin routes use.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/test/admin-reset-owner.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/users src/test/admin-reset-owner.test.ts
git commit -m "feat(api): owner team list + one-time reset-link minting

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: UI (forgot/reset pages, login link, Team panel)

**Files:**
- Create: `src/app/admin/(auth)/forgot-password/page.tsx`
- Create: `src/app/admin/(auth)/reset-password/page.tsx`
- Modify: `src/app/admin/(auth)/login/page.tsx` (add the "Forgot password?" link under the form; NOTE this file has uncommitted demo-door changes from a prior session, do not revert them)
- Create: `src/app/admin/(shell)/team/page.tsx`
- Modify: `src/app/admin/(shell)/layout.tsx` (add `<a href="/admin/team">Team</a>` after the Settings nav link, line ~40)
- Modify: `src/app/admin/admin.css` only if a needed class is missing (prefer existing classes; this file also has uncommitted prior changes)

**Interfaces:**
- Consumes: `POST /api/admin/auth/reset/request` `{email}`; `POST /api/admin/auth/reset/confirm` `{token,password}`; `GET /api/admin/users`; `POST /api/admin/users/[id]/reset-link`.
- Produces: pages only, nothing downstream.

No unit tests for these client components (matches the codebase: UI is verified by build + live smoke). Steps:

- [ ] **Step 1: Build the two auth pages**

Both are `"use client"` components styled with the same classes as `login/page.tsx` (inspect it first and reuse its form markup/classes and its fetch/error-handling pattern).

`forgot-password/page.tsx` behavior:
- Email field + submit "Send reset link".
- POST to `/api/admin/auth/reset/request`; on ANY 200 show the neutral confirmation: "If that account exists, a reset link is on its way. No email after a few minutes? Ask the owner to generate a link for you."
- Link back to `/admin/login`.

`reset-password/page.tsx` behavior:
- Reads `token` from `useSearchParams()` (wrap in `<Suspense>` if the build demands it, same as any other page using search params).
- Two fields: new password + repeat. Client-side check they match and length >= 12 before submitting.
- POST `{ token, password }` to `/api/admin/auth/reset/confirm`.
- On 200: "Password updated. Log in with your new password." + link to `/admin/login`.
- On 400: show the server message and a link to `/admin/forgot-password` to request a fresh link.

- [ ] **Step 2: Add the login-page link**

In `login/page.tsx`, under the submit button (outside the demo-door block), add:

```tsx
<p className="auth-alt"><a href="/admin/forgot-password">Forgot password?</a></p>
```

(Use an existing helper class from admin.css if `auth-alt` does not exist; check how the login page styles secondary text.)

- [ ] **Step 3: Build the Team page**

`(shell)/team/page.tsx`, `"use client"`, mirroring the fetch+table style of an existing shell page (`fleet` or `settings`):
- On mount GET `/api/admin/users` (with the same CSRF-header fetch helper the other shell pages use; GETs need no CSRF but reuse the shared client).
- Table: email, role, MFA on/off, created date.
- Per row a "Generate reset link" button → POST `/api/admin/users/{id}/reset-link` → show the returned URL ONCE in a readonly input with a Copy button (`navigator.clipboard.writeText`), plus the hint "Share this link with them directly, it works once and expires in 30 minutes."
- Add the nav entry in `layout.tsx`.

- [ ] **Step 4: Verify by build + live smoke**

```bash
npx tsc --noEmit
npm run build
```
Expected: both clean. Then (with `next dev` NOT running during the build, start it after):

```bash
npm run dev
```
Smoke: open `/admin/login` → "Forgot password?" → submit an email → neutral copy shows. Enter demo admin (demo door) → `/admin/team` → generate a reset link for the demo admin → open it in a private window → set a new 12+ char password → log in with it (TOTP still required). Reset the demo admin password back afterwards, or re-run the demo provisioning script.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(auth)/forgot-password" "src/app/admin/(auth)/reset-password" "src/app/admin/(auth)/login/page.tsx" "src/app/admin/(shell)/team" "src/app/admin/(shell)/layout.tsx" src/app/admin/admin.css
git commit -m "feat(admin): forgot/reset password pages + owner Team panel

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(If admin.css or login/page.tsx pick up unrelated uncommitted hunks from the earlier go-live session, stage only your hunks with `git add -p`.)

---

### Task 6: Full gates

**Files:** none new.

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all green (185 existing + the new admin-reset suites).

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean (dev server must not be running).

- [ ] **Step 3: Commit anything outstanding + verify log**

```bash
git status --short
git log --oneline -6
```
Expected: working tree has ONLY the pre-existing uncommitted go-live files (Dockerfile, worker/, wrangler.jsonc, next.config.ts, package.json/lock, env.ts, demo files, tsconfig.json); all reset-feature files are committed across Tasks 1-5.
