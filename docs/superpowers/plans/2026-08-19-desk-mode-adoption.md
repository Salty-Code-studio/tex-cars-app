# Desk Mode Adoption Wave (Tex Cars) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Mo the approval experience he asked for on 2026-08-19: a rich Telegram approval message with Confirm/Decline buttons (renter details plus a cars-left availability line), working confirmation emails to the customer and the business, and a properly designed booking confirmation page. Mechanism: adopt FleetDesk desk mode fully (Mo's explicit choice), retiring reserve mode.

**Architecture:** Cherry-pick the 31 `defer-task-8` ledger rows (FD desk-mode lineage, docs/PORT-LOG.md) onto a new branch, reconciling Tex's reserve semantics into desk per the mapping in docs/superpowers/specs/2026-08-18-tex-desk-vs-reserve-decision.md. Then three feature tasks on top: message enrichment, email wiring, confirmation-page redesign. Deploy happens LAST, with Mo, per Task 6.

**Requirements from Mo (verbatim intent):** buttons on the bot message; more renter information; how many cars are left; confirmation emails to customers and to ourselves when a confirmation completes; the last booking page redesigned with real graphic design, better copy.

**Tech Stack:** existing repo stack; FD source = fleetdesk remote main @ c96405a.

## Global Constraints

- Branch `feat/desk-mode-adoption` off main @ c59e450. NEVER deploy, push, merge, or touch the prod DB from Tasks 1-5; Task 6 is the only deploy task and runs with Mo's named approvals.
- All parity-port rules stay binding: MIGRATION RULE with the Note 9(b) when-remap for migration 0024 (FD fd_when 1786968554247), conflict playbook, protected files, Tex brand tokens, no user-visible FleetDesk strings, prose dash free, `npm test -- --no-file-parallelism`, no build while dev runs, PGlite single-writer.
- ENV RULE and CRON RULE apply: new env vars go into worker/index.ts CONTAINER_ENV_KEYS; the approval-reminders cron gets a Cloudflare trigger (hourly `0 * * * *`, allowed on Workers paid, restoring the design cadence FD had to daily-limit on Vercel Hobby) in wrangler.jsonc AND the scheduled() jobs map.
- PAYMENT_MODE end state: enum `stripe | desk`; `reserve` is retired with a boot-time error message naming the rename. NEXT_PUBLIC_PAYMENT_MODE follows identically (Dockerfile bake changes to `desk` in Task 6 only). Customer-facing behavior stays: pending booking, no online payment, pay at pickup.
- No license or DOB PII in any Telegram message.
- The desk confirmation email must branch on the succeeded-payment row exactly as FD built it (byte-behavior preserved); Tex reserve-confirm surfaces merge into the desk equivalents, not alongside them.
- sendOwnerTelegram (simple ping) is retired from notifyNewBooking wiring (the approval broadcast replaces it) but the module stays for potential compliance use; document the wiring change.

---

### Task 1: Port the desk-mode lineage with reserve reconciliation

**Files:** everything the 31 ledger rows touch (src/lib/approval/*, confirm-booking, webhook + approval + cron routes, schema/approvals.ts, migration 0024, env.ts, LAUNCH-style runbook bits, tests) plus the Tex reconciliation edits (env.ts enum, checkout/holds/wizard/confirmation/account/check-in reserve gates renamed to desk, admin Confirm surface merged into FD's desk-gated confirm).

- [ ] `git checkout -b feat/desk-mode-adoption` from c59e450; cherry-pick the 31 `defer-task-8` rows in ledger order per the playbook; per-commit targeted tests; ` (port <hash>)` suffixes.
- [ ] Migration 0024: keep the FD file name, journal idx 24 with remapped when = 1786970199527 + (1786968554247 - 1785176040444); snapshot reconciled per Notes 8/9; migration-smoke clean; the incremental-upgrade guard test extended to cover 0024.
- [ ] Reconciliation: every `PAYMENT_MODE === "reserve"` site flips to the desk equivalent from the FD code (grep inventory in the report); env.ts enum becomes `stripe | desk` with the retirement error for `reserve`; NEXT_PUBLIC cross-check preserved; the Tex admin "Confirm reservation" button and confirmBookingAdmin merge into FD's desk confirm path (single code path, atomic conditional update preserved).
- [ ] CONTAINER_ENV_KEYS += TELEGRAM_BOT_USERNAME, TELEGRAM_WEBHOOK_SECRET (TELEGRAM_BOT_TOKEN already forwarded); wrangler.jsonc crons += `0 * * * *`; scheduled() jobs map += approval-reminders route.
- [ ] Full suite + tsc + lint + migration-smoke green; commit ledger updates in docs/PORT-LOG.md (rows flip from defer-task-8 to ported).

### Task 2: Approval message enrichment

**Files:** src/lib/approval/message.ts (+ its tests), any availability helper it needs.

- [ ] Ground in the FD stock message first (read it; report what it already contains). Extend to include, in a clean scannable layout: renter name and email (phone only if the schema truly has it), booking start and end with times (Aruba local), vehicle class plus assigned car (name and plate), total price and deposit in USD, young-driver flag when the surcharge applies, and an availability line in the form "X of Y <class> cars free for these dates" computed with the existing availability/classes logic for the booking window.
- [ ] No PII beyond name/email/phone; no license data. Buttons and first-tap-wins behavior stay stock.
- [ ] Unit tests pin the message content for a desk booking fixture (including the availability line and the young-driver branch); suite green.

### Task 3: Email wiring

**Files:** src/lib/email/notifications.ts (+templates), settings seeding note, tests.

- [ ] On desk confirm (button tap or admin confirm), send BOTH: the customer confirmation (FD's desk email, payment-branching preserved) AND a new owner copy to settings.adminAlertRecipients ("Reservation confirmed" with booking summary). New-booking alerts to recipients already exist once Resend works; verify and cover with a test asserting the fan-out.
- [ ] sendAndLog rows verified written for sent, skipped, and failed paths (fix the zero-rows-in-prod observation if the skip path fails to log; test it).
- [ ] Do NOT hardcode recipients in code: they come from settings. Document in the report that Task 6 seeds `["info@saltycodestudio.com"]` in prod via the admin Settings UI or SQL, swapped or extended with the Tex owner's real address when Mo supplies it.

### Task 4: Confirmation page redesign

**Files:** src/app/(public)/book/confirmation/page.tsx + its CSS (new file allowed), copy strings.

- [ ] Redesign to a premium, branded layout per the studio's standards (hairlines, soft shadows, tone-on-tone cobalt/coral on the Tex palette, no cartoon styling): a clear success/pending state mark, a reservation summary card (class, car, dates and times, price breakdown, reservation reference), a "what happens next" three-step block (we confirm by email, questions via WhatsApp, pay at pickup with license), a WhatsApp CTA button using the site number, and a quiet contact footer. Both polling states (pending and confirmed) get designed states, desk copy, no payment language.
- [ ] Copy rewritten warm and human, dash free, EN only (matching the app's current language).
- [ ] Mobile-first: verify 390px composition in the dev server; screenshot list for the controller in the report.
- [ ] Suite green (adjust confirmation copy tests); tsc clean.

### Task 5: Gate

- [ ] Full suite + tsc + lint + `rm -rf .next && npm run build`; grep gate (no FleetDesk strings, no reserve literals outside the retirement error and historic docs); local desk-mode E2E: booking lands pending, approval request row created, message content generated (Telegram client mocked or logged in dev), button-decide route confirms atomically, emails logged; confirmation page renders both states.
- [ ] Present to Mo; STOP before Task 6.

### Task 6: Deploy with Mo (only with named approvals in-session)

- [ ] Merge to main after Mo's word, push.
- [ ] Prod DB: migration 0024 via db:migrate (Mo names the target as before); verify approval tables/columns.
- [ ] Secrets/vars: RESEND_API_KEY (Mo pastes), TELEGRAM_WEBHOOK_SECRET (generate), TELEGRAM_BOT_USERNAME=texcarsbot var, PAYMENT_MODE=desk + NEXT_PUBLIC_PAYMENT_MODE=desk in wrangler.jsonc, Dockerfile bake flips to desk; seed adminAlertRecipients.
- [ ] Rebuild image, push (wrangler containers push), deploy; run `npm run telegram:setup` against the live origin; send Mo his manager invite link (his chat 8985350174); Mo taps it; live E2E: real test reservation, button confirm, both emails arrive, message edits to "Confirmed by".
- [ ] Update GO-LIVE docs, ledger, handoff, memory.
