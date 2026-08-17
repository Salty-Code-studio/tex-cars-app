# Reservation Mode + Telegram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `PAYMENT_MODE=reserve` switch that turns the booking flow into pay-at-desk reservations with owner Telegram alerts and an admin Confirm action, leaving Stripe mode intact.

**Architecture:** Env enum + optional-with-refine Stripe keys; guards in checkout/holds; new `sendOwnerTelegram` dormant channel in notify.ts; `confirmBookingAdmin` service + route + ops-board button; copy switches in the two public booking pages via `NEXT_PUBLIC_PAYMENT_MODE`.

**Tech Stack:** Next.js 15, zod env, Drizzle/PGlite, vitest.

**Spec:** `docs/superpowers/specs/2026-08-17-reservation-mode-telegram-design.md`

## Global Constraints

- Default mode is `stripe`: the existing 200-test suite must stay green with NO test-env changes beyond what tasks add.
- All user-facing copy dash-free (no em-dashes, no `--`), warm and human.
- Never run `npm run build` while a dev server runs; never run vitest while `next dev` holds `.dev-db`.
- Pre-existing uncommitted files (Dockerfile, worker/, wrangler.jsonc, env.ts pre-existing hunks, package.json/lock, login page demo hunks, admin.css demo hunks, tsconfig.json, demo files, seed script, .mcp.json) must NOT be committed; stage only your own files/hunks (env.ts and page files need hunk-level staging via `git apply --cached` with a hand-edited patch, same technique Task 5 of the password-reset plan used).
- Commits on app main; messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Key integration points (verified): checkout call in `src/app/(public)/book/page.tsx:100-105`; `notifyNewBooking` at `src/lib/email/notifications.ts:31-52` (WhatsApp call line 48); WhatsApp dormant pattern `src/lib/notify.ts:70-84`; optional-env pattern `src/env.ts:188-194`; enum pattern `src/env.ts:186` (DEMO_MODE); Stripe required keys `src/env.ts:113-121`; RESEND optional-refine pattern `src/env.ts:162-166`; `cancelBookingAdmin` shape `src/lib/admin/move-booking.ts:118-130`; BookingPanel actions `src/app/admin/(shell)/page.tsx:462-467`; `expireStaleHolds` in `src/lib/payments/holds.ts`; checkout guard `src/lib/payments/checkout.ts:34`.

---

### Task 1: PAYMENT_MODE env + Stripe-optional + guards

**Files:**
- Modify: `src/env.ts` (add PAYMENT_MODE, NEXT_PUBLIC_PAYMENT_MODE, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID; relax the two Stripe keys to optional-with-refine)
- Modify: `src/lib/payments/stripe-client.ts` (guard unconfigured)
- Modify: `src/lib/payments/checkout.ts` (reserve-mode conflict)
- Modify: `src/lib/payments/holds.ts` (reserve-mode no-op)
- Test: `src/test/reservation-mode.test.ts`

**Interfaces:**
- Produces: `env.PAYMENT_MODE: "stripe" | "reserve"`, `env.NEXT_PUBLIC_PAYMENT_MODE`, `env.TELEGRAM_BOT_TOKEN: string`, `env.TELEGRAM_CHAT_ID: string` (empty string = unset). Later tasks rely on these exact names.

- [ ] **Step 1: Write failing tests**

```ts
// src/test/reservation-mode.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { runMigrations } from "@/lib/db/migrate";

beforeAll(async () => { await runMigrations(); });

describe("PAYMENT_MODE env", () => {
  // Follow the existing env test style in src/test/env-validation.test.ts:
  // build a base valid env object and mutate per case.
  it("reserve mode validates WITHOUT stripe keys", async () => {
    // parse a valid env with PAYMENT_MODE=reserve and both STRIPE_* removed -> success
  });
  it("stripe mode without stripe keys fails validation", async () => {
    // PAYMENT_MODE=stripe (or omitted) with STRIPE_SECRET_KEY removed -> safeParse fails
  });
  it("defaults to stripe mode", async () => {
    // valid env without PAYMENT_MODE -> parsed.PAYMENT_MODE === "stripe"
  });
});

describe("reserve-mode guards", () => {
  it("createBookingCheckout throws conflict in reserve mode", async () => {
    // vi.mock or env override: see how existing tests override env values
    // (search src/test for "env" mocking patterns, e.g. payments-env.test.ts).
    // Assert the thrown error is the conflict/409 error, not a Stripe call.
  });
  it("expireStaleHolds returns 0 and cancels nothing in reserve mode", async () => {
    // seed a stale pending booking (reuse helpers from payments tests if any),
    // run expireStaleHolds with reserve mode active, assert booking still pending.
  });
});
```

Write real assertions following `src/test/env-validation.test.ts` and `src/test/payments-env.test.ts` (READ both first; they already test env shapes and payments config and show how env is overridden per-test).

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/test/reservation-mode.test.ts`

- [ ] **Step 3: Implement**

env.ts (place next to the existing blocks; copy patterns exactly):

```ts
// Booking payment mode: "stripe" = online checkout (default), "reserve" =
// pay-at-desk reservations (no Stripe needed; owner confirms manually).
PAYMENT_MODE: z.enum(["stripe", "reserve"]).default("stripe"),
NEXT_PUBLIC_PAYMENT_MODE: z.enum(["stripe", "reserve"]).default("stripe"),

// Owner Telegram alerts. Dormant until BOTH are set (same contract as WhatsApp).
TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
TELEGRAM_CHAT_ID: z.string().optional().default(""),
```

Stripe keys: make both `.optional()` and add a schema-level `.superRefine` (or extend the existing one) enforcing: if `PAYMENT_MODE === "stripe"` then both keys present and format-valid (`sk_|rk_`, `whsec_`), else keys may be absent; if present they must still be format-valid. Mirror how RESEND_API_KEY does optional+format.

stripe-client: if the key is empty, throw a descriptive config Error from `getStripe()` (it can only be reached in stripe mode or a bug).

checkout.ts, first line of `createBookingCheckout`:
```ts
if (env.PAYMENT_MODE === "reserve") {
  throw Errors.conflict("Online payment is disabled");
}
```

holds.ts, first line of `expireStaleHolds`:
```ts
// In reserve mode "pending" means awaiting the owner's confirmation, not an
// unpaid hold; never auto-cancel it.
if (env.PAYMENT_MODE === "reserve") return 0;
```
(Match the function's actual return type; if it returns a count/array, return the empty equivalent.)

- [ ] **Step 4: Tests pass + full suite still green** — `npx vitest run src/test/reservation-mode.test.ts && npx vitest run`

- [ ] **Step 5: Commit** (hunk-stage env.ts to exclude pre-existing dirty hunks)

```bash
git add src/lib/payments/stripe-client.ts src/lib/payments/checkout.ts src/lib/payments/holds.ts src/test/reservation-mode.test.ts
# env.ts: stage ONLY your hunks (git diff src/env.ts > /tmp/env.patch, edit, git apply --cached)
git commit -m "feat(payments): PAYMENT_MODE switch, reserve mode boots without Stripe

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Telegram owner channel

**Files:**
- Modify: `src/lib/notify.ts` (add `sendOwnerTelegram`)
- Modify: `src/lib/email/notifications.ts` (call it in `notifyNewBooking`)
- Test: extend `src/test/reservation-mode.test.ts` (new describe) or `src/test/notifications.test.ts` style — put it where `sendOwnerWhatsApp` is tested today (READ `src/test/notifications.test.ts` first and mirror).

**Interfaces:**
- Consumes: `env.TELEGRAM_BOT_TOKEN`, `env.TELEGRAM_CHAT_ID` (Task 1).
- Produces: `sendOwnerTelegram(text: string): Promise<void>` exported from `@/lib/notify`.

- [ ] **Step 1: Failing tests** — mirror the existing WhatsApp tests (dormant skip when unconfigured; configured path calls fetch with the right URL/body, mocked; a fetch failure must not break `notifyNewBooking`).

- [ ] **Step 2: Verify failure.**

- [ ] **Step 3: Implement** — copy the `sendOwnerWhatsApp` block shape:

```ts
/**
 * Telegram ping to the owner. Dormant until TELEGRAM_BOT_TOKEN and
 * TELEGRAM_CHAT_ID are set. Throws on API failure; callers catch.
 */
export async function sendOwnerTelegram(text: string): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    logger.info({ event: "telegram_skipped_not_configured" });
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) throw new Error(`telegram_send_failed: ${res.status}`);
}
```

In `notifyNewBooking`, next to the existing `sendOwnerWhatsApp(...)` call (line ~48), add a `sendOwnerTelegram(...)` call with the same message text, wrapped in the same error-tolerant structure the WhatsApp call uses (READ how line 48's failure is contained; replicate).

- [ ] **Step 4: Tests + full suite green.**

- [ ] **Step 5: Commit** — `feat(notify): Telegram owner channel (dormant until configured)`

---

### Task 3: Admin Confirm action + customer email

**Files:**
- Modify: `src/lib/admin/move-booking.ts` (add `confirmBookingAdmin`)
- Create: `src/app/api/admin/bookings/[id]/confirm/route.ts`
- Modify: `src/lib/email/notifications.ts` (add `notifyReservationConfirmed`)
- Modify: `src/app/admin/(shell)/page.tsx` (Confirm button in BookingPanel)
- Test: `src/test/admin-confirm-booking.test.ts`

**Interfaces:**
- Consumes: `sendOwnerTelegram` (Task 2), `mutate` guard, `cancelBookingAdmin` as the shape template (move-booking.ts:118-130), cancel route as route template (`src/app/api/admin/bookings/[id]/cancel/route.ts`).
- Produces: `confirmBookingAdmin(id: string)` returning the same outcome shape `cancelBookingAdmin` returns; `POST /api/admin/bookings/[id]/confirm`; `notifyReservationConfirmed(bookingId: string): Promise<void>`.

- [ ] **Step 1: Failing tests** — service: pending→confirmed persists; conflict thrown for confirmed/cancelled/completed. Route: owner+CSRF confirms (mirror the authedRequest mock pattern from `src/test/admin-reset-owner.test.ts`, including its documented next/headers cookie mock); staff denied; audit row `admin.booking_confirmed` written. Notification: `notifyReservationConfirmed` sends a customer email with NO payment/"payment received" language (assert on subject/html via the email-log or template call, mirroring `src/test/notifications.test.ts`) and pings `notifyAdmin` + `sendOwnerTelegram`.

- [ ] **Step 2: Verify failure.**

- [ ] **Step 3: Implement** — `confirmBookingAdmin` mirrors `cancelBookingAdmin` exactly but transitions ONLY `pending → confirmed` (conflict on anything else). Route mirrors the cancel route with action `admin.booking_confirmed`, then fires `notifyReservationConfirmed(id)` best-effort (never fails the request). Email copy (dash-free): subject "Your Tex Cars reservation is confirmed", body confirming dates/car and "You pay the deposit at pickup. See you soon!". BookingPanel: add next to Cancel (page.tsx:467), shown only when `p.bar.status === "pending"`: button "Confirm reservation" calling `api(POST .../confirm)` then the same refresh path cancel() uses.

- [ ] **Step 4: Tests + full suite + `npx tsc --noEmit` green.**

- [ ] **Step 5: Commit** (hunk-stage page.tsx if demo hunks nearby) — `feat(admin): confirm reservation action + customer email`

---

### Task 4: Public copy switch + gates

**Files:**
- Modify: `src/app/(public)/book/page.tsx` (skip checkout + copy in reserve mode)
- Modify: `src/app/(public)/book/confirmation/page.tsx` (reserve copy)
- Test: none new (client components); verified by build + live smoke.

- [ ] **Step 1: Implement** — read `NEXT_PUBLIC_PAYMENT_MODE` (client-safe; see how NEXT_PUBLIC_DEMO_MODE is read in the login page and mirror). In reserve mode: `submit()` goes straight from the bookings POST to `/book/confirmation?id=...` (never calls the checkout endpoint); button copy "Reserve now", subtext "No payment needed today. You pay at pickup."; confirmation page pending copy "Reservation received! Tex Cars will confirm your reservation shortly. You pay the deposit at pickup."; confirmed copy "Reservation confirmed. See you at pickup!". Stripe-mode strings unchanged.

- [ ] **Step 2: Gates** — `npx tsc --noEmit`, `npm run build` (no dev server). Full `npx vitest run`.

- [ ] **Step 3: Live smoke (reserve mode)** — with `.env.local` TEMPORARILY adding `PAYMENT_MODE=reserve` + `NEXT_PUBLIC_PAYMENT_MODE=reserve` (REVERT after smoke): `npm run dev`, then: create a booking through POST /api/bookings (curl, like the booking tests' payloads); confirm it lands pending; demo-door session → POST /api/admin/bookings/{id}/confirm → 200; GET /api/bookings/{id} shows confirmed; checkout endpoint returns 409. Kill dev server, revert .env.local additions, cancel the smoke booking via the admin cancel route or leave it clearly-marked (email walk-in@…) and report which.

- [ ] **Step 4: Commit** — `feat(book): reservation-mode booking flow copy + checkout skip`
