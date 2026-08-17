# Reservation Mode (pay at desk) + Telegram Owner Alerts — Design

Date: 2026-08-17 · Status: approved by Mo (chat: "skip payment, reservation
via Telegram, owner confirms; deposit at desk") · Target: go-live launch mode

## Problem

Go-live is happening without Stripe. Customers should reserve a car online
with no payment step; the owner gets an instant Telegram message and
confirms or declines each reservation from the admin ops board. Payment and
deposit happen at the desk. Stripe stays in the codebase, switchable back on.

## Decision summary

A `PAYMENT_MODE` env switch (`stripe` | `reserve`, default `stripe`) plus a
`NEXT_PUBLIC_PAYMENT_MODE` mirror for client copy. In reserve mode the
booking flow stops at "pending", the hold expiry cron becomes a no-op, and a
new admin Confirm action moves pending → confirmed. Telegram is a new
dormant-until-configured owner channel exactly like the existing WhatsApp
one.

## Details

**Mode plumbing**
- `env.ts`: `PAYMENT_MODE: z.enum(["stripe","reserve"]).default("stripe")`;
  `NEXT_PUBLIC_PAYMENT_MODE` same shape (client copy only, server stays
  authoritative). `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` become
  optional WITH a `.refine`: required when `PAYMENT_MODE === "stripe"`
  (mirrors the RESEND_API_KEY optional pattern). Fail-closed is preserved:
  stripe mode without keys still refuses to boot.
- `getStripe()` (stripe-client) throws a clear config error if called
  unconfigured; `createBookingCheckout` and the checkout route throw
  conflict "Online payment is disabled" when `PAYMENT_MODE === "reserve"`.
- `expireStaleHolds` returns immediately (0 expired) in reserve mode:
  pending now means "awaiting owner confirmation", not "unpaid hold", and
  must never auto-cancel. Webhook route stays as-is (never fires without
  Stripe traffic; harmless).

**Customer flow (reserve mode)**
- `/book` page: skips the checkout POST entirely and goes straight to
  `/book/confirmation?id=...`. Submit button copy: "Reserve now" with
  subtext "No payment needed today. You pay at pickup." (dash-free).
- `/book/confirmation`: pending copy becomes "Reservation received! [Name at
  Tex] will confirm shortly. You pay the deposit at pickup."; confirmed copy
  "Reservation confirmed. See you at pickup!". Stripe-mode copy unchanged.

**Admin confirm**
- `confirmBookingAdmin(id)` in `src/lib/admin/move-booking.ts` mirroring
  `cancelBookingAdmin`: only `pending → confirmed`, conflict otherwise.
- Route `POST /api/admin/bookings/[id]/confirm` via `mutate` with audit
  action `admin.booking_confirmed`.
- Ops board `BookingPanel`: "Confirm reservation" button, shown only for
  `status === "pending"`, next to Cancel.
- On confirm: `notifyReservationConfirmed(bookingId)` in
  email/notifications.ts — customer email ("your reservation is confirmed",
  no payment language), `notifyAdmin` info row, owner Telegram ping. Does
  NOT reuse `notifyBookingConfirmed` (that one assumes a payments row and
  says "payment received").

**Telegram channel**
- `env.ts`: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` optional-with-default-""
  (WhatsApp block pattern). Dormant unless BOTH set.
- `sendOwnerTelegram(text)` in `src/lib/notify.ts` mirroring
  `sendOwnerWhatsApp`: POST
  `https://api.telegram.org/bot<token>/sendMessage` `{chat_id, text}`,
  skip-log when unconfigured, throw on non-ok (callers already catch).
- Wired next to the existing `sendOwnerWhatsApp` calls in
  `notifyNewBooking` and in the new `notifyReservationConfirmed`.

## Out of scope

- Decline-with-reason flow (owner uses existing Cancel).
- Customer Telegram/WhatsApp messages (owner-only channel).
- Removing Stripe code (mode switch keeps it).
- Marketing-site copy (config.js bookingUrl flip happens at deploy).

## Testing

Env: reserve mode boots without Stripe keys; stripe mode without keys fails.
Checkout route 409s in reserve mode. expireStaleHolds no-ops in reserve
mode. confirmBookingAdmin: pending→confirmed, conflict on
confirmed/cancelled/completed, audit written. Telegram: skips unconfigured,
sends when configured (fetch mocked), never crashes notifyNewBooking.
Existing 200 tests stay green in default stripe mode.
