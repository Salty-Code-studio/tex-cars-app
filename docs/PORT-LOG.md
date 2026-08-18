# Port Log: FleetDesk to Tex Cars parity port

Companion to `docs/superpowers/plans/2026-08-18-fleetdesk-parity-port-v2.md` (control plan) and
`docs/superpowers/plans/2026-07-27-wave-09-tex-port.md` (base playbook this plan amends).

## Setup

- Remote added: `git remote add fleetdesk /Users/monischahieroms/Desktop/SaltyCode/04-Products/saltycodestudio-products/fleetdesk`
- Fetched refs: `main`, `feat/wave-2026-07`, `feat/desk-mode-telegram-approval`, `feat/breakdown-swap`
- Port source pinned at `fleetdesk/main` @ `c96405a` (confirmed: `git rev-parse fleetdesk/main` = `c96405a24b0eddfbecf5b07235c58f9de9b6859c`)
- Working branch: `feat/fleetdesk-parity` (this repo)

## Baseline

`npm test -- --no-file-parallelism` run before any port work:

```
Test Files  42 passed (42)
     Tests  221 passed (221)
 Start at  19:26:06
  Duration  33.56s (transform 355ms, setup 85ms, import 5.91s, tests 25.04s, environment 2ms)
```

221/221 green. Baseline holds; proceeding is safe per the task gate.

## Decision legend

- **port** - carries FleetDesk feature/fix work Tex Cars should gain; a later task applies it (cherry-pick or whole-file copy per that task's own mechanics). This ledger only records the decision, not the apply method.
- **skip** - never port. Either FleetDesk-only surface with no Tex equivalent need (marketing funnel, early-access CSRF, demo door), a docs-only commit, or a verified no-op.
- **defer-task-8** - desk-mode / Telegram-approval feature lineage. Decision owned by Task 8's memo (`docs/superpowers/specs/2026-08-18-tex-desk-vs-reserve-decision.md`), not applied by this plan.
- **?** - inspected, does not fit a rule cleanly; flagged for controller adjudication (see Notes).

160 commits total on `fleetdesk/main` (root `6f5e08c` .. tip `c96405a`).

## Ledger

| Hash | Subject | Decision |
|---|---|---|
| 6f5e08c | FleetDesk: booking + operations platform for small rental operators | ? |
| 2344d3e | Admin redesign: saltycodestudio "Sand & Surf" design language | port |
| 369502f | feat(ui): Sand & Surf admin kit + branded DatePicker/Select | port |
| a288900 | feat(marketing): public funnel (landing, pricing, early-access) + lead capture | skip |
| 72f563d | feat(book): Sand & Surf booking flow + step-by-step animated wizard | port |
| a7ef368 | feat(admin): modernize admin (modals, toasts, command palette, custom controls) | port |
| 8c0cfc8 | docs: redesign + funnel/wizard/controls specs | skip |
| 32b6ea4 | fix(security): close OTP-leak account takeover + CSRF-guard guest booking/checkout | port |
| 1e0c855 | fix(security): cap per-victim rate limits independent of spoofable fingerprint | port |
| f525d5a | fix(security): add CSRF origin guard to /api/early-access | skip |
| 39f96f3 | docs(security): production hardening notes from the red-team (secrets-at-rest, rate-limit IP) | skip |
| 5af8b32 | feat(demo): env-gated one-click demo door for the ops app | skip |
| 724fec7 | chore(deploy): trigger Vercel production build (feat as prod branch) | skip |
| 713c11c | fix(security): upgrade Next.js 15.3.3 -> 15.5.20 (secure backport line) | port |
| 2a0a68e | docs: feature wave design spec (time, payments+extensions, alerts, check-in/out, under-21, fleet, reports, staff logins) | skip |
| 87bbbc3 | docs: cross-plan seams for the 2026-07 feature wave | skip |
| 3f8136b | docs: nine wave implementation plans (time, payments+extensions, alerts, fleet, young-driver, check-in/out, reports, staff, Tex port) | skip |
| 2eea63b | feat(time): Aruba wall-time helpers + isoDateTime validation | port |
| 44b42c2 | fix(time): scope parseTs offset padding to strings with a time component | port |
| 8a26078 | feat(time): timestamptz cutover for bookings, blocks, buffer hours, tstzrange exclusion incl picked_up | port (danger) |
| e3ddde0 | feat(time): business hours + 30 minute steps for public pickup/return times | port |
| 4a471a1 | feat(time): TimeSelect + wizard pickup/return times + opening hours settings | port |
| 78ca13e | fix(time): stop label.fld/.form-grid select rules from overriding TimeSelect | port |
| 79da67c | feat(board): fractional time bars, bar states, timed blocks and time editing | port |
| a30ccbc | feat(desk): advisory block/blackout conflicts with explicit override on manual bookings and moves | port |
| c90d574 | feat(time): human wall-time rendering across emails, confirmation, account, Stripe line | port |
| 7220eea | feat(ui): month + year quick-jump dropdowns in DatePicker calendar header | port |
| 076b9c5 | feat(payments): deposit-or-full money model, amount-paid tracking, desk/extension payment types | port |
| 2859497 | feat(payments): webhook credits amount paid, verifies against the recorded row, handles extension payments and charge.refunded | port |
| 47d6b52 | feat(brand): env-driven site config replaces hardcoded fleetdesk.app in public layout, emails, checkout | port |
| 2a25fba | feat(payments): pure amounts module, cancellation window policy, admin refunds | port |
| 7cb4a94 | feat(payments): customer cancellation auto-refunds outside the 48h window | port |
| ef85d53 | feat(admin): cancel with explicit refund or no-refund choice | port |
| 55c394d | Fix admin cancel dropping policySaysFree from cancellation email | port |
| 7d9c0b1 | feat(admin): BookingDrawer with payments, balance due, refund and cancel actions | port |
| 1cbbf02 | fix(admin): scope Escape-close to the topmost overlay only | port |
| 7d6d5a3 | feat(admin): rental extensions with availability check, delta pricing, link or desk payment | port |
| 80ff41f | feat(admin): extend rental modal with live delta preview and payment choice | port |
| ff407fa | feat(book): honest pay-now step with policy box, persistence and resume payment | port |
| 5662406 | feat(book): patient confirmation polling with manual check and WhatsApp fallback | port |
| c6323f1 | feat(compliance): vehicle expiry dates, alert stages, complianceAlertDays setting | port |
| 0c93851 | feat(compliance): expiry dates at the vehicle boundary + stage reset on date change | port |
| 5aa9663 | feat(compliance): adminDocumentExpiringEmail template | port |
| 94c5574 | feat(compliance): runComplianceAlerts staged 30d/7d/overdue + complianceOverview | port |
| 54a24c3 | feat(compliance): daily compliance-alerts cron route + vercel schedule | port |
| 6355620 | feat(admin): dashboard compliance card + GET /api/admin/compliance | port |
| 6a2d529 | feat(admin): fleet expiry DatePickers + due-soon compliance badges | port |
| 36f5ee2 | feat(admin): compliance first-warning threshold in Settings | port |
| 4784827 | feat(fleet): make, model, year and color columns on vehicles | port |
| e3d4af4 | feat(fleet): vehicle_notes table + notes lib (add, list, resolve, open counts) | port |
| 578cc69 | feat(fleet): escalate a vehicle note to an availability block | port |
| 8e978d7 | feat(fleet): notes and escalate admin API routes; vehicles list carries open-note counts | port |
| 67683d9 | feat(planning): open-note counts on planning vehicles | port |
| e6bb61d | feat(fleet): vehicle form captures make, model, year and color with auto-composed name | port |
| 471739c | feat(fleet): fleet list grouped by class with sticky headers, search and class chips | port |
| f9d5e25 | feat(fleet): notes drawer with add, resolve, block-car escalation and row badges | port |
| 5a07f4c | feat(planning): open-note badge on planning board vehicle labels | port |
| 7d5757a | feat(settings): young-driver age band settings, minDriverAge default 18 | port |
| 0aef67f | feat(quote): young-driver per-day surcharge line folded into subtotal | port |
| a3b1376 | feat(booking): driverAgeBand classifier for the young-driver policy | port |
| 89fbd5a | feat(booking): young-driver flag on public quotes + booking-config endpoint | port |
| b5993f9 | feat(booking): DOB truth-check reprice with priceAdjusted flag in createBooking | port |
| 4714078 | fix(admin): extension re-quote preserves the young-driver surcharge | port |
| 6327a31 | feat(admin): young-driver age and fee fields on the settings page | port |
| 15257e6 | feat(book): driver age selector, live young-driver quote, transparent price-update notice | port |
| e1d3c06 | fix(book): persist driver-age claim across refresh and gate reserve on it | port |
| 1c498cc | feat(storage): env-driven object storage facade with local driver and signed dev URLs | port |
| 8ce0571 | feat(storage): supabase driver, dev signed route, same-origin admin file streaming | port |
| a6da726 | feat(inspections): inspections table, inspection_kind enum, desk balance payment type | port |
| bf452f2 | feat(uploads): admin multipart upload endpoint with size/type caps and seams key formats | port |
| b605620 | feat(inspections): transitions guard, inspection upsert, desk balance payment, handover read | port |
| d6aef78 | feat(pdf): rental contract renderer with signature image and policy text | port |
| c5c4195 | feat(email): pickup and return summary templates, attachment passthrough for contracts | port |
| b49a7c9 | feat(inspections): complete pickup/return with contract PDF, bells, and summary emails | port |
| 190d6d6 | feat(api): handover read, inspection upsert/complete, desk payment routes | port |
| b2b7bf3 | feat(admin): wizard UI kit with camera capture, signature canvas, fuel selector | port |
| 11c4f41 | feat(admin): mobile-first 7-step check-in wizard with balance collect and signature | port |
| 7b30dd5 | fix(admin): block check-in step 4 advance on blank odometer reading | port |
| 644f2a8 | feat(admin): 5-step check-out wizard with side-by-side comparison and borg button | port |
| 499ef65 | fix(checkout-wizard): guard empty odometer field on step 3 | port |
| 03b6e5a | fix(checkout-wizard): guard empty partial-return amount on step 4 | port |
| b6c8f1b | feat(admin): drawer inspection panel with single-tap audited checklist and wizard entry | port |
| d74f63c | feat(retention): purge inspection media past licenseRetentionDays on the daily cron | port |
| 4e390aa | feat(reports): per-car monthly revenue matrix with borg summary, count picked_up as revenue | port |
| 2119ec8 | feat(reports): per-car revenue admin API route | port |
| 8b29881 | feat(reports): Sand & Surf revenue report PDF renderer, monthly and yearly | port |
| 7513e11 | feat(reports): revenue report PDF download route | port |
| 8a85701 | feat(reports): per-car matrix, borg panel and PDF downloads on the reports page | port |
| 239a93d | feat(staff): admin_users staff login columns (code hash, lockout, active, name) | port |
| 103c008 | feat(staff): owner-managed staff accounts lib (create, regenerate, deactivate) | port |
| d24ab09 | feat(staff): staff code login with shared 5-fail 15-minute lockout | port |
| 7249eed | feat(staff): staff-login route, admin.login audit marker, session plumbing | port |
| 8f01451 | feat(staff): owner staff CRUD routes (create, regenerate, activate toggle) | port |
| dd157b4 | feat(staff): role opt-ins for the staff capability routes | port |
| 68b7bd9 | fix(staff): opt in handover read and note resolve/reopen for staff | port |
| 2e0a9d8 | fix(staff): opt in file-serving read for staff inspection media | port |
| 11cf3c1 | feat(audit): action filter and human actor labels for who-did-what | port |
| 4c0963f | feat(staff): staff code path on the admin sign-in screen | port |
| e17eae4 | feat(staff): role-aware admin shell nav, owner-only bell, deactivation gate | port |
| c68ca0a | feat(staff): /admin/staff management page with one-time code reveal and recent logins | port |
| 69b3889 | fix(migrations): make 0015 enum change safe on populated DBs (55P04) | port |
| 62cdf97 | fix(payments): stop reconcileRefund zeroing real deposit on auto-refunded surplus | port |
| b7cd6e4 | fix(bookings): gate desk-settled extension payments to owners only | port |
| 4963683 | fix(uploads): reject oversized Content-Length before buffering multipart body | port |
| 5a1aba3 | fix(uploads): enforce byte cap mid-stream for multipart, not just declared Content-Length | port |
| 5de74c2 | fix(retention): consume driver_licenses.retainUntil in the daily cron | port |
| 1bd4473 | fix(retention): sweep driver_licenses on cancelled bookings too | port |
| 1261f62 | fix(admin): stop money inputs resetting to 0 on a decimal point | port |
| e2c6062 | fix(admin): adopt MoneyInput on all remaining money-entry fields | port |
| b556f2c | fix(booking): sync wizard business hours from settings, surface quote/classes errors | port |
| bff4ac6 | fix(settings): reject off-grid opening/closing minutes | port |
| 8a7693f | fix(auth): make staff-code lockout genuinely shared | port |
| cd38e90 | fix(storage): stop collapsing every storage failure into a 404 | port |
| 224260d | fix(email): use payment currency in cancellation email, not global settings | port |
| 035336a | fix(booking): use refundPayment's applied delta for cancellation refundCents | port |
| e7df5b4 | fix(admin): use refundPayment's applied delta for admin cancel refundCents too | port |
| 8d4e686 | fix(compliance): persist alert stage before dispatch, not after | port |
| 7bc20c0 | fix(payments): drop em-dash from Stripe checkout line-item names | port |
| dbe5d6f | fix(admin): reject moving a terminal-status booking before the advisory check | port |
| fd528a9 | fix(admin): import BookingDetail types instead of duplicating them | port |
| 2ff10f1 | fix(admin): only require return photos where check-out finds new damage | port |
| 6f1f83c | fix(admin): stop drag-move on the planning board from re-opening the drawer | port |
| c0009fa | fix(admin): reset drag-click guard on every bar pointerdown, not just beginGesture | port |
| 706456d | fix(admin): give ConfirmDialog's non-danger confirm button its own style | port |
| fbb3bb9 | fix(admin): group settings fields into labelled sections | port |
| f2f2b8b | docs(admin): spec for breakdown vehicle swap | skip |
| 6e7bb14 | feat(admin): breakdown swap — reassign a booking to a replacement car | port |
| a046f60 | feat(admin): day-zoom hour grid on the planning board | port |
| d478dd4 | feat(ui): mobile + tablet adaptation across admin, booking and marketing | port |
| 87e21bc | docs: desk mode + internal chat approval design spec | defer-task-8 |
| b306a5a | docs: switch chat approval channel to Telegram (per-client bot, no router) | defer-task-8 |
| 19ff400 | docs: implementation plan for desk mode + telegram approval | defer-task-8 |
| 15b59cc | feat(env): PAYMENT_MODE=desk boots without Stripe, Telegram bot vars | defer-task-8 |
| c0cf78b | docs(plan): strip em-dashes from code snippets (Mo's copy rule) | defer-task-8 |
| ceeda85 | fix(env): drop em-dash from telegram comment | defer-task-8 |
| f9b2541 | feat(desk-mode): bookings without a payment provider, guarded checkout and cron | defer-task-8 |
| bcd177c | test(desk-mode): cover stripe webhook refusal | defer-task-8 |
| 82888ff | feat(schema): approval_requests table + approval manager settings | defer-task-8 |
| e48cb57 | feat(approval): signed single-use tokens for email decision links | defer-task-8 |
| 2d3ff7a | test(approval): cover short-mac length-mismatch branch in verify | defer-task-8 |
| 52f0bc1 | feat(approval): booking summary message with live fleet check line | defer-task-8 |
| 042b2f0 | test(approval): pin fleet-line status, class, cancelled and buffer semantics | defer-task-8 |
| 93342ac | feat(approval): telegram bot client + pure update parser | defer-task-8 |
| de8dc6c | fix(approval): explicit empty keyboard on edit + /start word boundary | defer-task-8 |
| 6b159c6 | feat(approval): request creation + first-tap-wins decision core | defer-task-8 |
| 3e64898 | fix(approval): harden request creation ordering + pin guarded flip and hash check | defer-task-8 |
| 84a8e27 | feat(approval): telegram webhook with invite linking, taps, in-place edits | defer-task-8 |
| f710f2a | test(approval): cover /start deny path + log swallowed answer failures | defer-task-8 |
| 9ec7171 | feat(approval): email decision endpoints + scanner-safe review page | defer-task-8 |
| 1313d85 | sec(http): redact path-embedded approval tokens from request logs | defer-task-8 |
| f739dfa | test(approval): direct scanner-safety assertions on GET summary | defer-task-8 |
| ffa9733 | feat(approval): admin confirm action + hourly reminder cron with janitor | defer-task-8 |
| 5fd4b21 | feat(desk-mode): wizard + confirmation copy, admin confirm button, managers settings UI | defer-task-8 |
| c58b0a5 | fix(desk-mode): gate admin confirm to desk deployments + truthful desk policy copy | defer-task-8 |
| d6ab31e | docs: desk mode + telegram approval rollout runbook | defer-task-8 |
| a3d06a0 | fix(desk-mode): final-review must-fixes | defer-task-8 |
| 755ec01 | fix(approval): final-review hardening wave | defer-task-8 |
| 158c24a | docs: runbook corrections from final review | defer-task-8 |
| 7813bcc | docs: note first-tap-wins re-link path in runbook | defer-task-8 |
| c96405a | fix(ops): daily approval-reminders cron for Vercel Hobby, hourly on Pro documented | defer-task-8 |

## Totals

- Total commits: 160
- `port`: 118 (one flagged `port (danger)`)
- `skip`: 10
- `defer-task-8`: 31
- `?`: 1

## Notes

1. **`6f5e08c` (root commit, flagged `?`).** This is FleetDesk's own repo-root commit: no parent, 231 files, 41007 insertions, dated 2026-06-23 - the entire FleetDesk codebase squashed at fork time. Tex Cars has its own separate root history starting 2026-06-11 (`0d86cf2` "chore: scaffold from fort nextjs-route-handlers starter"). There is no sane cherry-pick or whole-file-copy target for a 231-file root commit against an already-established, differently-structured codebase, and no downstream task (Task 2 starts at `32b6ea4`, Task 3 copies whole files as of `713c11c`) claims it. Recommend the controller confirm this row stays informational-only (row kept in the ledger for completeness; no action taken against it), rather than porting or skipping it as a unit.

2. **Breakdown-swap disambiguation.** A literal `git rev-list fleetdesk/feat/desk-mode-telegram-approval --not fleetdesk/feat/wave-2026-07` returns 39 commits, not the 31 marked `defer-task-8` above. The extra 8 (`2ff10f1`, `6f1f83c`, `c0009fa`, `706456d`, `fbb3bb9`, `f2f2b8b`, `6e7bb14`, `a046f60`) plus `d478dd4` are topologically "between" `feat/wave-2026-07`'s merge point and the desk-mode branch's creation point, but they are not desk-mode commits: `git merge-base fleetdesk/main fleetdesk/feat/breakdown-swap` = `a046f60`, confirming these 8 are `feat/breakdown-swap`'s own history (merged to `main` before desk-mode branched off), and `d478dd4` is a mobile-adaptation commit made directly to `main` right after. This matches the control plan's Task 5 scope exactly ("breakdown swap, day-zoom hour grid, mobile pass" and "ledger entries between the wave-08 tail and the desk-mode lineage"). These 9 are classified `port` (except `f2f2b8b`, docs-only, `skip`) rather than `defer-task-8`. The true desk-mode-only range is `87e21bc` through `7813bcc` (30 commits, confirmed as `git merge-base fleetdesk/main fleetdesk/feat/desk-mode-telegram-approval` = `7813bcc`), plus `c96405a` added explicitly per the brief since it sits on `main` after the desk-mode lineage rebased in.

3. **`0014_hot_mesmero` (migration file, leads/marketing).** Added only in `a288900` (drizzle/0014_hot_mesmero.sql, the marketing/early-access feature), already `skip`. Verified via `git log -S"hot_mesmero"` across all fetched refs: no other `fleetdesk/main` commit touches it. Per the control plan's Migration Rule, Tex's own idx-14 migration is `0014_majestic_sunspot` (admin_reset_tokens, Tex-only) - a different, unrelated migration at the same index. FD's `0014_hot_mesmero` is never ported, consistent with `a288900` = skip.

4. **`8a26078` flagged `port (danger)`.** This commit adds `drizzle/0016_high_gladiator.sql` (bookings `date` -> `timestamptz` with a 09:00 America/Aruba backfill and a gist constraint rebuild). Per the control plan's Global Constraints: "FD `0016_high_gladiator` is PROD-DANGEROUS... It is fine on fresh local PGlite... the live-data rehearsal lives in Task 9's runbook and is NOT executed by this plan." Still `port` for local/dev purposes; the prod rollout of this specific migration is gated entirely on Task 9 (`GO-LIVE-PARITY.md`) and Mo.

5. **`724fec7` (`chore(deploy): trigger Vercel production build`) classified `skip`.** Verified via `git show 724fec7`: empty diff, zero files changed. It is a FleetDesk-only deploy-trigger no-op (Co-Authored-By trailer only). Nothing to port.

6. **Non-conventional subjects.** `6f5e08c`, `2344d3e` ("Admin redesign: ..."), and `55c394d` ("Fix admin cancel...") do not use the `type(scope):` convention the rest of the log follows. `2344d3e` and `55c394d` are ordinary incremental diffs (4 files / 302 insertions, and a small fix respectively) and are classified normally (`port`). Only `6f5e08c` is flagged (see note 1).

7. **Docs-only rule applied.** `skip` was given to every commit whose subject starts `docs:`/`docs(` (or which touches only `docs/` paths) *outside* the desk-mode lineage: `8c0cfc8`, `39f96f3`, `2a0a68e`, `87bbbc3`, `3f8136b`, `f2f2b8b`. Inside the desk-mode lineage, docs-prefixed commits (`87e21bc`, `b306a5a`, `19ff400`, `c0cf78b`, `d6ab31e`, `158c24a`, `7813bcc`) are `defer-task-8` instead, since the named lineage rule is the more specific instruction and Task 8 owns the whole desk-mode surface (code and docs together) pending Mo's decision.

## Owner settings to confirm (carried forward for Task 6)

Per the control plan's Task 6 amendment, flagging here so it is not lost: `minDriverAge` must stay at Tex's current production value, not silently reset to FleetDesk's default of 18. When Task 6 runs, confirm with the owner: young-driver age and fee, cancellation window, deposit percent, opening and closing times.

## Backport candidates to FleetDesk

Tex-only features that FleetDesk's `main` lacks and could be backported into the FleetDesk product itself (out of scope for this port; noted for the product owner):

- **Admin forgot-password + team panel** - `src/app/admin/(auth)/forgot-password/page.tsx`, `src/app/admin/(auth)/reset-password/page.tsx`, `src/lib/auth/admin-reset.ts`, `src/app/api/admin/auth/reset/request/route.ts`, `src/app/admin/(shell)/team/page.tsx`. Verified absent from `fleetdesk/main` (no `forgot`/`reset-password`/`team` paths in its tree); FleetDesk only has the staff-code login system, no self-serve password reset or team page.
- **`sendOwnerTelegram` owner ping** - `src/lib/notify.ts`. A simple single-owner Telegram notify on new/confirmed bookings. Verified absent from `fleetdesk/main` (`git grep sendOwnerTelegram fleetdesk/main` returns nothing); FleetDesk instead built the much larger multi-manager Telegram approval system on `feat/desk-mode-telegram-approval` (see `defer-task-8` rows), which solves a different problem (approval workflow, not a simple ping).
