# Tex Cars: Desk Mode vs Reserve Mode (Decision Memo for Mo)

Date: 2026-08-19 · Status: awaiting Mo's decision · No code ported by this memo
Branch: `feat/fleetdesk-parity` (not merged)
Related: `docs/PORT-LOG.md` (full port ledger + Notes), the control plan's Task 8
(`docs/superpowers/plans/2026-08-18-fleetdesk-parity-port-v2.md`), FleetDesk's own
`docs/superpowers/specs/2026-08-17-desk-mode-chat-approval-design.md` and
`LAUNCH.md` ("Desk mode + Telegram approvals" section).

This is a one-page decision memo, not an implementation plan. Nothing in
FleetDesk's desk-mode lineage has been ported: the port ledger already isolated
it as its own 31-commit range (`87e21bc`..`7813bcc`, 30 commits, plus `c96405a`),
marked `defer-task-8` in `docs/PORT-LOG.md` end to end. This memo lays out what
Tex has today, what that lineage adds, and three ways forward, so Mo can pick one
at the next planned session.

---

## 1. What Tex reserve mode does today

- `PAYMENT_MODE=reserve` (server) and `NEXT_PUBLIC_PAYMENT_MODE=reserve` (client
  bundle) are set together; `src/env.ts` fails closed at boot if they ever
  disagree. No Stripe checkout happens in this mode: `POST
  /api/bookings/[id]/checkout` returns `409 "Online payment is disabled"`
  (verified live in Task 7's gate smoke).
- A guest booking lands as `status: "pending"` straight from the wizard, no
  payment step.
- The owner confirms from the admin: the booking drawer's "Confirm reservation"
  button calls `confirmBookingAdmin` (`src/lib/admin/move-booking.ts`), an
  atomically guarded `pending -> confirmed` flip (conditional `UPDATE ...
  WHERE status = 'pending'`, so a booking cancelled between the read and the
  write can never be resurrected). One admin, one button, no chat loop.
- Alongside that: `sendOwnerTelegram` (`src/lib/notify.ts`) pushes a one-way
  message to a single Telegram chat (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`)
  on new-booking and confirmation events, regardless of payment mode. It is
  outbound only: no buttons, no reply handling, nothing Telegram sends back
  ever reaches the app. Dormant until both vars are set; WhatsApp and email are
  the other channels alongside it. This is a genuinely simple ping, not an
  approval system.
- The mode is decided once, baked into the container image at build time:
  `NEXT_PUBLIC_PAYMENT_MODE` is inlined into the client JS bundle by a
  hardcoded `ENV` line in the Dockerfile's builder stage (not a runtime var,
  not a `--build-arg`). See section 5.

## 2. What FleetDesk desk mode adds

- Same shape at the mode-flag level (`PAYMENT_MODE=desk` on FD's own repo, same
  fail-closed contract, Stripe becomes optional, Stripe routes 409/404), but a
  materially bigger feature sits behind it: a whole approval engine
  (`src/lib/approval/`) plus one migration.
- **New DB surface** (FD's migration `0024_magenta_captain_midlands.sql`, which
  would land as Tex's `0024` too, the next number after this port's own
  `0015`-`0023`): a new `approval_status` enum, an `approval_requests` table
  (`open` / `confirmed` / `declined` / `closed`, one open request per booking
  via a partial unique index, `sentTo` tracking per-channel delivery,
  reminder count/timestamp, who decided and on which channel), and three new
  `settings` columns (`approval_managers` jsonb, `approval_reminder_hours`,
  `approval_max_reminders`). No `ALTER TYPE ... ADD VALUE` on an existing
  type here (it's a brand-new enum and a brand-new table), so on inspection
  this migration does not carry the same same-transaction 55P04 hazard
  `0015`/`0016` had, but it should still run through the incremental-upgrade
  regression test before it ships, same as every migration this port added.
- **A real Telegram bot**, not just an outbound ping: one BotFather bot per
  deployment, `TELEGRAM_BOT_TOKEN` + `TELEGRAM_BOT_USERNAME` +
  `TELEGRAM_WEBHOOK_SECRET`, and an inbound webhook route
  (`POST /api/webhooks/telegram`) that verifies the secret header and handles
  two things: manager linking (`/start <inviteCode>`) and Confirm/Decline
  button taps (`callback_query`).
- Every new booking gets a message to every **linked manager** (a list
  configured in Settings, not a hardcoded single chat id) with a live fleet
  check line ("4 of 6 Economy free on those dates") and inline Confirm/Decline
  buttons.
- **First-tap-wins**: a row lock plus a guarded status update means exactly one
  tap decides; every other manager's copy of the message is edited in place to
  show who decided, buttons removed.
- **Email fallback, always on**: managers with an email get a decision email
  with Approve/Decline buttons carrying a signed single-use token, landing on
  a review page that requires a real click (never confirms on a bare GET, so
  a corporate mail scanner can't trigger it by prefetching the link).
- **Reminders**: a cron re-pings `open` requests after a configurable delay
  (default 4h) up to a configurable max (default 1), plus a janitor pass that
  closes stale requests whose booking already moved on elsewhere (the admin,
  for instance). Vercel's Hobby plan caps FD's own cron at once daily; a Pro
  plan allows hourly.
- The admin keeps a manual **Confirm** button as a fallback that works whether
  or not Telegram is linked; the chat loop is a convenience layer, never a
  gate, and nothing auto-cancels an unanswered booking.
- **Setup is a real per-client runbook**, not a flag flip: create the bot with
  BotFather, set three env vars, run `npm run telegram:setup` (registers the
  webhook via Telegram's `setWebhook`, not present in Tex's `package.json`
  today), add managers in **Settings > Booking approvals** and save before
  sending invite links (a link copied before the save 404s politely instead of
  linking), then work through `LAUNCH.md`'s manual E2E checklist (place a test
  booking, confirm both managers get the ping, tap Confirm on one phone, watch
  the other's message update in place, confirm the customer email, confirm a
  second tap answers "already handled," confirm one reminder fires on an
  unanswered booking).
- Worth flagging directly, for accuracy: FleetDesk's own rollout plan (the
  2026-08-17 design spec, section 10) assumed Tex would eventually get desk
  mode by moving onto a fresh FleetDesk deployment, not by porting the
  approval engine into the older Tex Phase 2 codebase a second time. This
  parity port has already gone the other way for everything else (porting
  FleetDesk's improvements INTO Tex's own repo, wave by wave), so Option B
  below assumes that same path continues rather than standing up a parallel
  deployment. Flagging the discrepancy so it's a chosen path, not an
  overlooked one.

## 3. Three ways forward

**Option A: keep reserve mode as is.**
Zero new work. What Task 7's gate already verified stays true: the owner taps
Confirm, `sendOwnerTelegram` pings one chat, done. Ceiling: one owner, one
outbound-only channel, no buttons, no reminder if the ping gets missed, and no
record of who acted if more than one person ever checks that phone.

**Option B: adopt desk mode fully.**
Port the ledger's already-isolated `defer-task-8` range using the same
cherry-pick and hand-merge discipline the rest of this port used. Concretely
needs: a BotFather bot for Tex (minutes, free), `TELEGRAM_BOT_USERNAME` +
`TELEGRAM_WEBHOOK_SECRET` added to `src/env.ts` and `CONTAINER_ENV_KEYS`,
migration `0024` staged with the same 55P04 check and journal `when` remap
every prior migration in this port got, a container rebuild and redeploy (see
section 5), manager linking with the owner and whoever else should be trusted
with a Confirm button, and one decision this memo does not make for Mo: what
happens to the existing `sendOwnerTelegram` single ping once the richer
approval message exists on the same bot (retire the plain ping in favor of the
button message, or leave both running and accept two separate Telegram
messages per booking). Gives Tex real Confirm/Decline buttons, more than one
person able to act from their own phone, an audit trail of who decided,
automatic reminders, and an email fallback that works with no Telegram setup
at all.

**Option C: desk engine, owner as the single manager.**
The same port as B (the engine is not simpler with one manager, only the
Settings list is shorter), but **Settings > Booking approvals** has exactly one
manager row: the owner. A strict upgrade over A with none of B's "who else
gets a phone" coordination: same buttons, same first-tap-wins safety (moot with
one manager, but harmless), same email fallback and reminders, without
deciding who else on staff should be trusted with a confirm button yet. A
reasonable stepping stone toward B if Mo wants the richer UX now but is not
ready to onboard a second manager.

## 4. Env mapping (reserve to desk, stripe to online)

| Concept | Tex today (reserve) | FleetDesk desk mode | Note |
|---|---|---|---|
| No-online-payment flag | `PAYMENT_MODE=reserve` / `NEXT_PUBLIC_PAYMENT_MODE=reserve` | `PAYMENT_MODE=desk` | Same shape (no Stripe, a human confirms), different literal. Tex's `src/env.ts` schema only accepts `"stripe" \| "reserve"` today; B/C need a decision on whether to add a third literal or keep `reserve` as the value and layer the approval engine on top of it. |
| Online-payment flag | `PAYMENT_MODE=stripe` / `NEXT_PUBLIC_PAYMENT_MODE=stripe` | `PAYMENT_MODE=online` | Unaffected either way; Stripe checkout is untouched by this decision. |
| Owner notify (today) | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (single chat, outbound only) | n/a (superseded by the bot below) | Already in `CONTAINER_ENV_KEYS`; this is Tex's own pre-existing protected feature, not something FleetDesk has. |
| Manager bot (new) | not present | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_BOT_USERNAME` + `TELEGRAM_WEBHOOK_SECRET` (inbound webhook, multi-manager) | The token name collides with Tex's existing var; B/C need to decide one bot serving both purposes, or two bots with two tokens. Not yet defined anywhere in Tex's `src/env.ts`. |
| Manager list | not present (hardcoded single chat id) | `settings.approval_managers` (jsonb, admin-editable) | New column, migration `0024`. |
| Confirm action | `confirmBookingAdmin`, admin UI only | same guarded flip, reachable from the admin button, a Telegram tap, or an email link | B/C keep today's admin Confirm button working exactly as it does now; it becomes one of three paths in, not a replacement. |
| Setup script | none | `npm run telegram:setup` (registers the webhook) | Not present in Tex's `package.json` today. |

## 5. The NEXT_PUBLIC redeploy constraint

`NEXT_PUBLIC_PAYMENT_MODE` is inlined into the client JS bundle at `next build`
time by a hardcoded `ENV` line in the Dockerfile's builder stage (lines
57-68), not read from `process.env` at runtime like the server-only vars, and
not passed as a `--build-arg`. `src/env.ts`'s boot-time check additionally
requires the server's `PAYMENT_MODE` and the client's
`NEXT_PUBLIC_PAYMENT_MODE` to literally match, failing closed otherwise.

Practical effect: **choosing B or C does not take effect by flipping a
Cloudflare Worker secret or var.** If the port keeps `PAYMENT_MODE`'s existing
`reserve` literal and treats desk mode as new plumbing layered on top (the
lighter-touch reading of the env table above), the client copy may not need to
change at all, only the migration and the approval engine. If it instead adds
a distinct third literal, the Dockerfile's hardcoded `ENV` block has to change,
the container image has to be rebuilt via the crane path, and `wrangler
deploy` has to run again (see `GO-LIVE-PARITY.md`). Either way, there is no
supported way to flip this live; it is baked at image build time.

## 6. Recommendation

**Option B, at the next planned session with Mo. Option A stays in place until
then.** Reserve mode already covers the operational floor Task 7 verified end
to end: bookings land, the owner gets pinged, the owner confirms with one tap.
There is no urgency that justifies rushing the BotFather setup and the
manager-linking decision (who else gets a Confirm button) without Mo in the
room for both, since those specifically need his phone and his call. Nothing
changes on the live branch until that session happens.

---

## 7. Owner settings to confirm (annex)

One more decision input surfaced after the control plan was written, while
gating Task 7, unrelated to desk mode itself but belonging in front of Mo at
the same sitting since it is the same kind of "owner has to pick a number"
item:

**The young-driver surcharge is currently unreachable.** Task 6 pinned
`minDriverAge` at Tex's real value (21) and left `youngDriverAge` at wave 05's
default (also 21). With the two equal, `driverAgeBand`
(`src/lib/booking/license.ts`) rejects anyone under `minDriverAge` outright as
`under_min` before the `young` branch between `minDriverAge` and
`youngDriverAge` can ever be reached; anyone 21+ is always `standard`. Not a
code defect (the unit suite already covers the `young` branch correctly using
`minDriverAge: 18, youngDriverAge: 21`, a real, working gap), confirmed live in
Task 7's gate smoke (booking as a claimed 19-year-old returned `400 "Driver
must be at least 21 years old"` instead of the expected reprice). Full trace:
`.superpowers/sdd/task-7-gate-report.md`, "Finding: the young-driver surcharge
is currently unreachable."

This is not this memo's or any prior task's call to make. The full confirm
list, current seed values, and reasoning already live in `docs/PORT-LOG.md`'s
**"Owner settings to confirm"** section (`minDriverAge`, `youngDriverAge` /
`youngDriverFeeCentsPerDay`, `cancellationWindowHours`, `depositPercent` /
`depositMinCents`, `openingTime` / `closingTime`). Add one line to that same
conversation: if the young-driver surcharge should ever actually apply,
`youngDriverAge` needs to move above `minDriverAge` (for example 21/24, giving
the surcharge an 18-to-20-equivalent band above the real minimum); otherwise
it stays a fully built, currently dormant feature by choice, which is a
legitimate answer too.
