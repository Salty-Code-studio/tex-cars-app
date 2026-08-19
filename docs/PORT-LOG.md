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

- **port** - carries FleetDesk feature/fix work Tex Cars should gain; a later task applies it (cherry-pick or whole-file copy per that task's own mechanics). This ledger only records the decision, not the apply method. One row uses the variant `port (danger)`: still port, but the commit carries the PROD-DANGEROUS 0016 migration (see Note 4).
- **skip** - never port. Either FleetDesk-only surface with no Tex equivalent need (marketing funnel, early-access CSRF, demo door), a docs-only commit, or a verified no-op.
- **defer-task-8** - desk-mode / Telegram-approval feature lineage. Decision owned by Task 8's memo (`docs/superpowers/specs/2026-08-18-tex-desk-vs-reserve-decision.md`), not applied by this plan.
- **?** - inspected, does not fit a rule cleanly; flagged for controller adjudication (see Notes).

160 commits total on `fleetdesk/main` (root `6f5e08c` .. tip `c96405a`).

## Ledger

| Hash | Subject | Decision |
|---|---|---|
| 6f5e08c | FleetDesk: booking + operations platform for small rental operators | skip (FD root snapshot of Tex's own base at fork time; nothing to port, controller-adjudicated) |
| 2344d3e | Admin redesign: saltycodestudio "Sand & Surf" design language | port (ported, Task 3 `45cdd1a`) |
| 369502f | feat(ui): Sand & Surf admin kit + branded DatePicker/Select | port (ported, Task 3 `45cdd1a`) |
| a288900 | feat(marketing): public funnel (landing, pricing, early-access) + lead capture | skip |
| 72f563d | feat(book): Sand & Surf booking flow + step-by-step animated wizard | port (ported, Task 3 `45cdd1a`) |
| a7ef368 | feat(admin): modernize admin (modals, toasts, command palette, custom controls) | port (ported, Task 3 `45cdd1a`) |
| 8c0cfc8 | docs: redesign + funnel/wizard/controls specs | skip |
| 32b6ea4 | fix(security): close OTP-leak account takeover + CSRF-guard guest booking/checkout | port (ported, Task 2 `24cbded`) |
| 1e0c855 | fix(security): cap per-victim rate limits independent of spoofable fingerprint | port (ported, Task 2 `9264192`) |
| f525d5a | fix(security): add CSRF origin guard to /api/early-access | skip |
| 39f96f3 | docs(security): production hardening notes from the red-team (secrets-at-rest, rate-limit IP) | skip |
| 5af8b32 | feat(demo): env-gated one-click demo door for the ops app | skip |
| 724fec7 | chore(deploy): trigger Vercel production build (feat as prod branch) | skip |
| 713c11c | fix(security): upgrade Next.js 15.3.3 -> 15.5.20 (secure backport line) | port (ported, Task 2 `16c1c9f`) |
| 2a0a68e | docs: feature wave design spec (time, payments+extensions, alerts, check-in/out, under-21, fleet, reports, staff logins) | skip |
| 87bbbc3 | docs: cross-plan seams for the 2026-07 feature wave | skip |
| 3f8136b | docs: nine wave implementation plans (time, payments+extensions, alerts, fleet, young-driver, check-in/out, reports, staff, Tex port) | skip |
| 2eea63b | feat(time): Aruba wall-time helpers + isoDateTime validation | port (ported, Task 4 wave 01 `6d4d37b`) |
| 44b42c2 | fix(time): scope parseTs offset padding to strings with a time component | port (ported, Task 4 wave 01 `72c3b85`) |
| 8a26078 | feat(time): timestamptz cutover for bookings, blocks, buffer hours, tstzrange exclusion incl picked_up | port (danger) (ported, Task 4 wave 01 `1e7b189`, snapshot-chain fix `f5f7f64`; see Notes 4 and 8) |
| e3ddde0 | feat(time): business hours + 30 minute steps for public pickup/return times | port (ported, Task 4 wave 01 `cba0648`) |
| 4a471a1 | feat(time): TimeSelect + wizard pickup/return times + opening hours settings | port (ported, Task 4 wave 01 `f44d1d1`) |
| 78ca13e | fix(time): stop label.fld/.form-grid select rules from overriding TimeSelect | port (ported, Task 4 wave 01 `1a8e5a9`) |
| 79da67c | feat(board): fractional time bars, bar states, timed blocks and time editing | port (ported, Task 4 wave 01 `f932643`) |
| a30ccbc | feat(desk): advisory block/blackout conflicts with explicit override on manual bookings and moves | port (ported, Task 4 wave 01 `ff57ce3`) |
| c90d574 | feat(time): human wall-time rendering across emails, confirmation, account, Stripe line | port (ported, Task 4 wave 01 `07f3aac`) |
| 7220eea | feat(ui): month + year quick-jump dropdowns in DatePicker calendar header | port (ported, Task 4 wave 01 `c5e63c1`) |
| 076b9c5 | feat(payments): deposit-or-full money model, amount-paid tracking, desk/extension payment types | port (ported, Task 4 wave 02 `3fa0231`; migration 0017, see Note 10) |
| 2859497 | feat(payments): webhook credits amount paid, verifies against the recorded row, handles extension payments and charge.refunded | port (ported, Task 4 wave 02 `2dc8491`) |
| 47d6b52 | feat(brand): env-driven site config replaces hardcoded fleetdesk.app in public layout, emails, checkout | port (ported, Task 4 wave 02 `b9fc0f6`; env mapping, see Note 10) |
| 2a25fba | feat(payments): pure amounts module, cancellation window policy, admin refunds | port (ported, Task 4 wave 02 `6ea1df6`) |
| 7cb4a94 | feat(payments): customer cancellation auto-refunds outside the 48h window | port (ported, Task 4 wave 02 `31f458f`) |
| ef85d53 | feat(admin): cancel with explicit refund or no-refund choice | port (ported, Task 4 wave 02 `8a7e3d4`) |
| 55c394d | Fix admin cancel dropping policySaysFree from cancellation email | port (ported, Task 4 wave 02 `cb99433`) |
| 7d9c0b1 | feat(admin): BookingDrawer with payments, balance due, refund and cancel actions | port (ported, Task 4 wave 02 `76da12b`; Tex confirm-reservation action restored, see Note 10) |
| 1cbbf02 | fix(admin): scope Escape-close to the topmost overlay only | port (ported, Task 4 wave 02 `080c520`) |
| 7d6d5a3 | feat(admin): rental extensions with availability check, delta pricing, link or desk payment | port (ported, Task 4 wave 02 `89bbb10`) |
| 80ff41f | feat(admin): extend rental modal with live delta preview and payment choice | port (ported, Task 4 wave 02 `cd3b1ec`) |
| ff407fa | feat(book): honest pay-now step with policy box, persistence and resume payment | port (ported, Task 4 wave 02 `fee8f3d`) |
| 5662406 | feat(book): patient confirmation polling with manual check and WhatsApp fallback | port (ported, Task 4 wave 02 `864ff53`) |
| c6323f1 | feat(compliance): vehicle expiry dates, alert stages, complianceAlertDays setting | port (ported, Task 4 wave 03 `2894428`; migration 0018, see Note 11) |
| 0c93851 | feat(compliance): expiry dates at the vehicle boundary + stage reset on date change | port (ported, Task 4 wave 03 `4982b30`) |
| 5aa9663 | feat(compliance): adminDocumentExpiringEmail template | port (ported, Task 4 wave 03 `651ada9`) |
| 94c5574 | feat(compliance): runComplianceAlerts staged 30d/7d/overdue + complianceOverview | port (ported, Task 4 wave 03 `487cd24`) |
| 54a24c3 | feat(compliance): daily compliance-alerts cron route + vercel schedule | port (ported, Task 4 wave 03 `adbbcc9`; CRON RULE Cloudflare side, see Note 11) |
| 6355620 | feat(admin): dashboard compliance card + GET /api/admin/compliance | port (ported, Task 4 wave 03 `d2071f0`) |
| 6a2d529 | feat(admin): fleet expiry DatePickers + due-soon compliance badges | port (ported, Task 4 wave 03 `f582a36`) |
| 36f5ee2 | feat(admin): compliance first-warning threshold in Settings | port (ported, Task 4 wave 03 `475a36a`) |
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
| 69b3889 | fix(migrations): make 0015 enum change safe on populated DBs (55P04) | port (ported, hoisted into the Task 4 wave-01 fix loop as `9627e05`; see Note 9) |
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
- `skip`: 11
- `defer-task-8`: 31
- `?`: 0

## Notes

1. **`6f5e08c` (root commit, flagged `?`).** This is FleetDesk's own repo-root commit: no parent, 231 files, 41007 insertions, dated 2026-06-23 - the entire FleetDesk codebase squashed at fork time. Tex Cars has its own separate root history starting 2026-06-11 (`0d86cf2` "chore: scaffold from fort nextjs-route-handlers starter"). There is no sane cherry-pick or whole-file-copy target for a 231-file root commit against an already-established, differently-structured codebase, and no downstream task (Task 2 starts at `32b6ea4`, Task 3 copies whole files as of `713c11c`) claims it. ADJUDICATED by the controller 2026-08-18: decision `skip` (the commit is FD's snapshot of Tex's own base at fork time, so there is nothing to port; the row stays in the ledger for completeness only).

2. **Breakdown-swap disambiguation.** A literal `git rev-list fleetdesk/feat/desk-mode-telegram-approval --not fleetdesk/feat/wave-2026-07` returns 39 commits, not the 31 marked `defer-task-8` above. The extra 8 (`2ff10f1`, `6f1f83c`, `c0009fa`, `706456d`, `fbb3bb9`, `f2f2b8b`, `6e7bb14`, `a046f60`) plus `d478dd4` are topologically "between" `feat/wave-2026-07`'s merge point and the desk-mode branch's creation point, but they are not desk-mode commits: `git merge-base fleetdesk/main fleetdesk/feat/breakdown-swap` = `a046f60`, confirming these 8 are `feat/breakdown-swap`'s own history (merged to `main` before desk-mode branched off), and `d478dd4` is a mobile-adaptation commit made directly to `main` right after. This matches the control plan's Task 5 scope exactly ("breakdown swap, day-zoom hour grid, mobile pass" and "ledger entries between the wave-08 tail and the desk-mode lineage"). These 9 are classified `port` (except `f2f2b8b`, docs-only, `skip`) rather than `defer-task-8`. The true desk-mode-only range is `87e21bc` through `7813bcc` (30 commits, confirmed as `git merge-base fleetdesk/main fleetdesk/feat/desk-mode-telegram-approval` = `7813bcc`), plus `c96405a` added explicitly per the brief since it sits on `main` after the desk-mode lineage rebased in.

3. **`0014_hot_mesmero` (migration file, leads/marketing).** Added only in `a288900` (drizzle/0014_hot_mesmero.sql, the marketing/early-access feature), already `skip`. Verified via `git log -S"hot_mesmero"` across all fetched refs: the only other hit is `3f8136b`, a docs-only wave-plan commit that mentions the filename in prose without touching the file (already `skip` via the docs-only rule). Per the control plan's Migration Rule, Tex's own idx-14 migration is `0014_majestic_sunspot` (admin_reset_tokens, Tex-only) - a different, unrelated migration at the same index. FD's `0014_hot_mesmero` is never ported, consistent with `a288900` = skip.

4. **`8a26078` flagged `port (danger)`.** This commit adds `drizzle/0016_high_gladiator.sql` (bookings `date` -> `timestamptz` with a 09:00 America/Aruba backfill and a gist constraint rebuild). Per the control plan's Global Constraints: "FD `0016_high_gladiator` is PROD-DANGEROUS... It is fine on fresh local PGlite... the live-data rehearsal lives in Task 9's runbook and is NOT executed by this plan." Still `port` for local/dev purposes; the prod rollout of this specific migration is gated entirely on Task 9 (`GO-LIVE-PARITY.md`) and Mo.

5. **`724fec7` (`chore(deploy): trigger Vercel production build`) classified `skip`.** Verified via `git show 724fec7`: empty diff, zero files changed. It is a FleetDesk-only deploy-trigger no-op (Co-Authored-By trailer only). Nothing to port.

6. **Non-conventional subjects.** `6f5e08c`, `2344d3e` ("Admin redesign: ..."), and `55c394d` ("Fix admin cancel...") do not use the `type(scope):` convention the rest of the log follows. `2344d3e` and `55c394d` are ordinary incremental diffs (4 files / 302 insertions, and a small fix respectively) and are classified normally (`port`). Only `6f5e08c` is flagged (see note 1).

7. **Docs-only rule applied.** `skip` was given to every commit whose subject starts `docs:`/`docs(` (or which touches only `docs/` paths) *outside* the desk-mode lineage: `8c0cfc8`, `39f96f3`, `2a0a68e`, `87bbbc3`, `3f8136b`, `f2f2b8b`. Inside the desk-mode lineage, docs-prefixed commits (`87e21bc`, `b306a5a`, `19ff400`, `c0cf78b`, `d6ab31e`, `158c24a`, `7813bcc`) are `defer-task-8` instead, since the named lineage rule is the more specific instruction and Task 8 owns the whole desk-mode surface (code and docs together) pending Mo's decision.

8. **Task 4 wave 01 migration numbering + the `8a26078` snapshot correction.** FD's two wave-01 migrations kept their exact FD filenames per the Global MIGRATION RULE: `drizzle/0015_smiling_thunderbolt.sql` (enum: adds `picked_up` to `booking_status`) and `drizzle/0016_high_gladiator.sql` (the danger migration, see Note 4). Journal: Tex's `idx 14` (`0014_majestic_sunspot`) is untouched; `idx 15`/`idx 16` were appended with FD's exact filenames and, initially, FD's exact `when` values. This note originally claimed those `when` values were inert creation metadata; that claim was WRONG and the values were later remapped - see Note 9(b) for the real semantics (drizzle's migrator uses `when` as its high-water mark) and the reconciliation. Fresh-database smoke (`DATABASE_URL=pglite://.migration-smoke npm run db:migrate`) was clean throughout, but a fresh smoke cannot see populated-DB hazards. Separately, `drizzle/meta/0016_snapshot.json` (FD's own file, copied verbatim by the cherry-pick) claimed the current schema included FD's `early_access_leads` table (marketing funnel, `a288900` = skip, never ported) and was missing Tex's own `admin_reset_tokens` table (`0014`, password reset, FD doesn't have this feature) - a real problem for the *next* `db:generate`, though irrelevant to the raw SQL migration smoke, which only reads `_journal.json` + the `.sql` files and never touches snapshot JSON. Hand-patched `0016_snapshot.json`'s `tables` map to swap `early_access_leads` for Tex's `admin_reset_tokens` (copied verbatim from `0014_snapshot.json`), and re-chained `0015_snapshot.json`'s `prevId` to Tex's real `0014` snapshot id (`0015`'s own `tables` map was NOT reconciled at that point - completed later, see Note 9(c)). The 0016 patch was made during the `8a26078` port step but a process slip (edited the working tree, never re-staged) meant it missed that commit; it landed one commit later as `f5f7f64`. Full detail in `.superpowers/sdd/task-4-wave01-report.md`.

9. **Wave-01 review fix loop: 55P04 hoist, journal `when` reconciliation, 0015 snapshot completion.** The wave-01 review found two populated-DB hazards the fresh-PGlite gates were structurally blind to, plus one leftover from Note 8. All three fixed in the wave-01 fix loop (commits `78615e8`, `3ff4ab3`, `9627e05`).
   (a) **55P04.** The ported 0015 used `ALTER TYPE ... ADD VALUE`; drizzle applies every pending migration in ONE transaction, so on any DB committed at `<=0014` the 0016 exclusion-constraint predicate referencing `picked_up` fails with 55P04 ("unsafe use of new value"). Fresh installs dodge it because the type is created in the same transaction. FD's own later fix `69b3889` (0015 rewritten as an in-transaction TYPE-SWAP via `booking_status_v2`, plus an incremental-upgrade regression test that applies 0000..0014, commits a bookings row, then applies 0015+ separately) touches only the 0015 SQL file and the new test, no later-wave code, so it was hoisted forward out of its ledger slot into wave 01 as `9627e05`. Verified both ways in Tex before committing: old SQL = 55P04 on 0016's constraint statement exactly as FD documented; new SQL = green.
   (b) **Silent skip (worse).** `runMigrations` delegates to drizzle's stock migrator for BOTH PGlite and prod Postgres, and that migrator gates each migration on `lastDbMigration.created_at < folderMillis` (i.e. the journal `when` value IS the apply high-water mark, contra Note 8's original claim). With FD's `when` values (`1785...`) below Tex's idx-14 entry (`1786970199526`), any DB already migrated through 0014 silently skipped 0015 and 0016: `db:migrate` reported success and applied nothing. Reproduced by the hoisted regression test (22P02 "invalid input value for enum booking_status: picked_up" after a clean-looking phase-2 migrate). Fixed in `3ff4ab3` per the port brief's journal contingency clause: FD `when` values remapped onto a base just above Tex's 0014, preserving FD's relative order and spacing. **Formula for every later wave's appended FD migrations (binding on waves 02+): `new_when = 1786970199527 + (fd_when - 1785176040444)`.** idx 15 -> `1786970199527`, idx 16 -> `1786970346316`; journal strictly monotonic end to end. No DB exists with the old `when` values recorded (0015/0016 never applied outside throwaway smoke dirs; `.dev-db` and prod are at `<=0014`), so the remap is safe.
   (c) **0015 snapshot tables map.** `f5f7f64` only half-reconciled `0015_snapshot.json`: `prevId` was re-chained but the `tables` map still carried FD's `early_access_leads` and lacked Tex's `admin_reset_tokens`. Completed in `78615e8` with the same patch 0016 received (block byte-identical to `0014_snapshot.json`, 21 tables).
   Gates after the loop: incremental-upgrade test green, fresh migration smoke green, `npx tsc --noEmit` clean, full suite 50 files / 255 tests green.

10. **Wave 02: migration 0017 hardening check (none needed) and the site-config env mapping.**
    (a) **0017 hardening.** Per the port brief's instruction, checked FD's history for a later 55P04-safe rewrite of `drizzle/0017_wave02_money_model.sql` before porting it: `git -C <FD> log --oneline --all -- drizzle/0017*` returns only `076b9c5` itself (the migration was never touched again), and `git -C <FD> log --grep 55P04 --oneline --all` returns only `69b3889`, the fix already hoisted into wave 01. No hardening commit exists to hoist. Separately verified 0017 is safe in isolation, not just absent-of-a-fix: its three `ALTER TYPE "payment_type" ADD VALUE ...` statements are the LAST three statements in the file, and no statement after them (in 0017 or in any other wave-02 migration, since 0017 is the only migration this wave adds) references `rental_deposit`/`rental_full`/`extension` in a DDL or predicate context, which is what actually triggers 55P04 (an ADD VALUE used, not just present, within the same transaction it was added in - the 0015/0016 bug was 0016's exclusion-constraint predicate using 0015's new value, not the ADD VALUE itself). Confirmed empirically, not just by inspection: `src/test/migration-incremental-upgrade.test.ts`'s existing phase-2 `migrate()` call applies the real `DRIZZLE_DIR`, which now includes 0017, so the same populated-DB regression guard that would have caught an unsafe 0017 already exercises it every run - green throughout this wave. Forward-looking note for whichever wave adds the next payment_type-referencing migration (desk-mode's `payment_type` uses are all in `defer-task-8` scope, not yet ported): if a later migration references `rental_deposit`/`rental_full`/`extension` in a CHECK constraint, partial index, or exclusion predicate, re-run this same check before assuming ADD VALUE is safe.
    (b) **Site-config env mapping.** `47d6b52` introduces exactly three env vars, all `NEXT_PUBLIC_*` (`NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WHATSAPP_NUMBER`), none server-only - so `src/env.ts`'s Zod schema and `CONTAINER_ENV_KEYS` in `worker/index.ts` are untouched this wave (verified: `git diff 52ea88a..HEAD --stat` against both files is empty). `src/lib/site-config.ts`'s fallback defaults were changed from FD's own (`"FleetDesk"` / `"https://fleetdesk.app"`) to Tex's (`"Tex Cars"` / `"https://tex-cars.com"`), so every siteConfig consumer renders correctly with zero env vars set. `.env.local` (gitignored) also got the three vars with real values (`NEXT_PUBLIC_WHATSAPP_NUMBER=2975945454`, sourced from `site/data/config.js`'s `waNumber`) so local dev exercises the "real" env-var path, not just the fallback. Because these are `NEXT_PUBLIC_*` vars, Next.js inlines them into the CLIENT bundle at `next build` time (see the `NEXT_PUBLIC_PAYMENT_MODE` precedent and its comment block in `Dockerfile` lines 50-56) - a runtime container env var alone would only fix server-rendered output (SSR, email templates), not the shipped client JS. Recorded as a Task 9 runbook item below rather than touched here, per the port brief's explicit carve-out for `NEXT_PUBLIC_*` vars.

11. **Wave 03: migration 0018 remap + snapshot reconciliation, and the CRON RULE's Cloudflare side.**
    (a) **Migration 0018.** `c6323f1` kept FD's exact filename `drizzle/0018_watery_stark_industries.sql` per the MIGRATION RULE (five `ALTER TABLE` statements: four new `vehicles` columns, one new `settings` column; no enum surgery, so none of the 55P04 same-transaction hazard Notes 4/9(a) describe applies here). `git cherry-pick -n` auto-merged `drizzle/meta/_journal.json` cleanly but, as expected per Note 9(b), carried FD's raw idx-18 `when` (`1785201242039`) verbatim - below Tex's idx-17 `when` (`1786982009627`), which would have silently skipped 0018 on any DB already migrated through 0017, and would have failed the `migration-incremental-upgrade.test.ts` journal-monotonicity guard. Remapped by hand using the binding formula: `1786970199527 + (1785201242039 - 1785176040444) = 1786995401122`, strictly greater than idx 17's value. `drizzle/meta/0018_snapshot.json` had the same FD-only/Tex-only divergence Notes 8/9/10 found at every prior wave boundary (`early_access_leads` present, `admin_reset_tokens` missing); patched by swapping the table entry for a byte-identical copy of `0017_snapshot.json`'s `admin_reset_tokens` block (confirmed via direct object-equality check, not just visual diff). `prevId` needed no fix this time: FD's own chain id (`cfd53e78-...`) already matched Tex's real 0017 snapshot id, since both repos cherry-picked identical 0015-0017 content with the same generated ids. Verified via the incremental-upgrade regression test (phase 1 to 0014 committed, phase 2 applies 0015 onward including the new 0018 in one transaction) and a fresh migration-smoke, both green.
    (b) **CRON RULE, Cloudflare side.** `54a24c3`'s own diff only touches `vercel.json` (documentation mirror, hand-merged per the wave-03 amendment: kept Tex's `*/15` expire-holds, added the `0 9` compliance-alerts entry - FD's parallel diff had also changed expire-holds to a daily `0 3` schedule, which was NOT adopted, since Tex's real hold-expiry cadence is unrelated to FD's and the port brief is explicit that only the compliance entry gets added). The actual cron TRIGGER for Tex runs through Cloudflare, not Vercel, so the CRON RULE's second half (`wrangler.jsonc` `triggers.crons` + a `worker/index.ts` `scheduled()` dispatch keyed on `controller.cron`) was hand-implemented as its own commit (`2c6c2fb`, not tied to any FD hash - FD has no Cloudflare Container deploy path to have written this in the first place). Code matches the v2 plan's Task 4 wave-03 code block verbatim; `_controller` (previously unused, prefixed) became `controller` since the dispatch now reads `controller.cron`. Both files are on the PROTECTED list but this is the exact wave-specific authorized edit. `worker/` is excluded from the main `tsconfig.json` (`"exclude": ["node_modules", "worker"]`), so `npx tsc --noEmit` does not and cannot cover it; there is no dedicated worker typecheck script in `package.json`. Verification for this file is manual code review against the plan's block (verbatim match confirmed) plus the existing `fetch()`/container/env-forwarding code around it being left untouched (`git diff` shows only the `triggers` block and the `scheduled()` body changed). A self-review pass after all 8 ledger commits landed caught two em-dashes in this hand-written commit's own new comments (violates the binding dash-free rule); fixed in a follow-up commit (`010f01c`) rather than amending, per the no-amend rule. Pre-existing em-dashes elsewhere in both files (from before this wave, e.g. the file's own header comment) were left untouched as out of scope for this wave's authorized edit.

## Task 9 runbook items (carried forward, do not execute now)

- **NEXT_PUBLIC_SITE_NAME / NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_WHATSAPP_NUMBER** (from wave 02's `47d6b52`, Note 10(b)): add an `ENV NEXT_PUBLIC_SITE_NAME=... NEXT_PUBLIC_SITE_URL=... NEXT_PUBLIC_WHATSAPP_NUMBER=...` line to the Dockerfile's builder stage, mirroring the existing `NEXT_PUBLIC_PAYMENT_MODE` block (Dockerfile lines 57-68), and add the two non-secret values to `wrangler.jsonc`'s `vars` block alongside `PAYMENT_MODE`/`NEXT_PUBLIC_PAYMENT_MODE` for documentation parity (the container-runtime copy only helps server-rendered output; the client bundle needs the Docker build-time value). Real values: `NEXT_PUBLIC_SITE_NAME=Tex Cars`, `NEXT_PUBLIC_SITE_URL=https://tex-cars.com`, `NEXT_PUBLIC_WHATSAPP_NUMBER=2975945454` (E.164 digits, no `+`; from `site/data/config.js`'s `waNumber`).

## Owner settings to confirm (carried forward for Task 6)

Per the control plan's Task 6 amendment, flagging here so it is not lost: `minDriverAge` must stay at Tex's current production value, not silently reset to FleetDesk's default of 18. When Task 6 runs, confirm with the owner: young-driver age and fee, cancellation window, deposit percent, opening and closing times.

## Backport candidates to FleetDesk

Tex-only features that FleetDesk's `main` lacks and could be backported into the FleetDesk product itself (out of scope for this port; noted for the product owner):

- **Admin forgot-password + team panel** - `src/app/admin/(auth)/forgot-password/page.tsx`, `src/app/admin/(auth)/reset-password/page.tsx`, `src/lib/auth/admin-reset.ts`, `src/app/api/admin/auth/reset/request/route.ts`, `src/app/admin/(shell)/team/page.tsx`. Verified absent from `fleetdesk/main` (no `forgot`/`reset-password`/`team` paths in its tree); FleetDesk only has the staff-code login system, no self-serve password reset or team page.
- **`sendOwnerTelegram` owner ping** - `src/lib/notify.ts`. A simple single-owner Telegram notify on new/confirmed bookings. Verified absent from `fleetdesk/main` (`git grep sendOwnerTelegram fleetdesk/main` returns nothing); FleetDesk instead built the much larger multi-manager Telegram approval system on `feat/desk-mode-telegram-approval` (see `defer-task-8` rows), which solves a different problem (approval workflow, not a simple ping).

## Task 3: Sand & Surf admin kit + booking wizard port

Commits: `45cdd1a` (main port) + `4436d6d` (follow-up fix restoring the reserve-mode pending label on the account page; see Preservation evidence, last bullet). Source revision: `fleetdesk` remote at `713c11c` (the composed, post-redesign state of commits `369502f`, `2344d3e`, `72f563d`, `a7ef368`; whole-file copy per the task brief, not a patch apply).

### Copy vs hand-merge, per file group

**Pure whole-file copy, no Tex-specific content to preserve** (31 files: hex + text remapped mechanically, see below):
`src/components/ui/**` (DatePicker, Select, CSS, index), `src/app/admin/_ui/**` (10 files: AdminChrome, CommandPalette, ConfirmDialog, Drawer, EmptyState, Modal, Skeleton, Toast, useOverlay, index), the 7 new per-page admin CSS files (`audit.css`, `catalog.css`, `dashboard.css`, `fleet.css`, `policies.css`, `reports.css`, `settings.css`), 6 shell `page.tsx` files (`audit`, `catalog`, `fleet`, `policies`, `reports`, `settings`), the dashboard `(shell)/page.tsx` (planning board + inline legend-swatch hex, remapped), `(auth)/mfa/page.tsx`, `(public)/account/login/page.tsx`.

**Hand-merge, structure from FD + Tex-specific content re-applied** (10 files):
`(shell)/side-nav.tsx` (new; Team link added), `(shell)/layout.tsx` (logo wordmark + metadata), `admin.css` (full `:root` brand-token restoration + 2 added rule blocks), `(auth)/layout.tsx` (metadata only, mechanical otherwise), `(auth)/login/page.tsx` (demo panel + forgot-password link preserved), `(public)/layout.tsx` (header wordmark + href), `public.css` (full `.pub{}` brand-token restoration), `(public)/book/page.tsx` (RESERVE_MODE re-applied onto the 7-step wizard), `(public)/book/confirmation/page.tsx` (RESERVE_MODE + back-link re-applied onto the new card layout), `(public)/account/page.tsx` (RESERVE_MODE pending-label re-applied onto the restyled page; initially shipped in `45cdd1a` as a pure copy, caught in post-commit self-review and fixed in the follow-up commit).

**Not copied / untouched, verified via `git status`:** `(auth)/forgot-password/page.tsx`, `(auth)/reset-password/page.tsx`, `(shell)/team/page.tsx`, `src/env.ts`, `scripts/seed.ts`, `wrangler.jsonc`, `worker/index.ts`, `Dockerfile`, `next.config.ts`.

### Re-brand replacements (`grep -rn "FleetDesk|fleetdesk"` on every copied file, full list)

| File | Original (FD) | Replaced with |
|---|---|---|
| `(shell)/layout.tsx` | `title: "FleetDesk Admin"` | `title: "Tex Cars Admin"` |
| `(shell)/layout.tsx` | `<span className="logo-word">FleetDesk</span>` | `<span className="logo-word">TEX<b>CARS</b></span>` (hand-merge, not mechanical) |
| `admin.css` | header comment "FleetDesk admin: ..." | "Tex Cars admin: ..." |
| `admin.css` | comment "Clean \"~< FleetDesk\" brand lockup..." | "Clean \"~< Tex Cars\" brand lockup..." |
| `(shell)/settings/page.tsx` | placeholder `"owner@fleetdesk.app, ops@fleetdesk.app"` | `"owner@tex-cars.com, ops@tex-cars.com"` |
| `(auth)/mfa/page.tsx` (x3) | `<p className="auth-brand">FleetDesk</p>` | `<p className="auth-brand">Tex Cars</p>` |
| `_ui/index.ts` | comment "FleetDesk admin modern-UI kit..." | "Tex Cars admin modern-UI kit..." |
| `components/ui/date-picker.css` | comment "FleetDesk DatePicker - ..." | "Tex Cars DatePicker - ..." |
| `components/ui/select.css` | comment "FleetDesk Select - ..." | "Tex Cars Select - ..." |
| `(auth)/layout.tsx` | `title: "FleetDesk Admin"` | `title: "Tex Cars Admin"` |
| `(auth)/login/page.tsx` | `<p className="auth-brand">FleetDesk</p>` | `<p className="auth-brand">Tex Cars</p>` (hand-merge, demo panel + forgot-password link re-applied around it) |
| `(public)/layout.tsx` | `title: "Book a car \| FleetDesk"` | `title: "Book a car \| Tex Cars & Leasing"` |
| `(public)/layout.tsx` | `href="https://fleetdesk.app" aria-label="FleetDesk home"` + `<span className="pub-brand-word">FleetDesk</span>` | `href="https://tex-cars.com" aria-label="Tex Cars home"` + `<span className="pub-brand-word">TEX<b>CARS</b></span>` (hand-merge) |
| `public.css` | header comment "FleetDesk public booking flow..." | "Tex Cars public booking flow..." |
| `book/confirmation/page.tsx` | `<a href="https://fleetdesk.app">Back to fleetdesk.app</a>` | `<a href="https://tex-cars.com">&larr; Back to tex-cars.com</a>` (Tex's pre-existing exact copy restored, per the conflict playbook's "Back to ..." link rule, not FD's) |

Post-port full-tree `grep -rn "FleetDesk\|fleetdesk" src/` returns nothing.

### Brand token restoration (admin.css `:root` + public.css `.pub{}`)

FD's Sand & Surf palette is a semantic-token system (`--sand`/`--teal`/`--coral`/`--sky`/etc.), not raw color literals in the body rules (confirmed: zero `var(--navy)`/`var(--blue)` usages in FD's body CSS at 713c11c; only the `:root`'s own legacy-repoint block used them). This meant restoring Tex's brand was a values-only swap inside `:root`/`.pub{}`; the body rules needed no changes since they already reference tokens by name. Mapping (FD hex -> Tex hex), applied mechanically via a one-off Python script across every copied CSS/TSX file (hex literals, `var(--x, #fallback)` defaults in date-picker.css/select.css, and `rgba(r,g,b,a)` decimal shadow tints alike):

- `--teal` (primary ink / buttons / sidebar): `#0E3A40` -> `#15192F` (Tex navy, exact)
- `--teal-700` / `--teal-600` (hover shades): `#0A2C31`/`#14474E` -> `#0C0E1C`/`#1B2036` (derived darker navy; no prior Tex value existed for a navy hover state, since Tex's old scheme hovered a *different* color, cobalt, in this slot)
- `--coral` / `--coral-600` (THE accent): `#FF6F59`/`#F2563F` -> `#F15F2C` (Tex coral, exact per brief) / `#D94E1F` (Tex's pre-existing darker-coral hover value, reused)
- `--coral-lift` (public CTA hover, lighter not darker): `#FF7D68` -> `#F47850` (derived lighter Tex coral)
- `--sky` (secondary accent: tags/charts/info): `#4FA8C9` -> `#2348C7` (Tex cobalt). Cobalt was Tex's *original* primary/button color; in the new system it's demoted to the secondary-accent slot, matching where Tex already used it for charts/info tags before this port.
- `--sand`/`--sand-2` (canvas / hover tint): `#F2EBDD`/`#EAE0CD` -> `#F7F8FC`/`#EFF3FC` ("Tex canvas": Tex's pre-existing cool `--surface` value and its "today" tint, not FD's warm cream)
- `--panel` (card surface): `#FCFAF4` -> `#FFFFFF` (Tex's existing plain-white cards)
- `--ink`/`--ink-soft`/`--ink-mute`: -> `#15192F`/`#4A5170`/`#828AA6` (Tex's existing values; `--ink-mute` matches the fallback Tex's pre-port CSS already used inline)
- `--line`/`--line-soft`/`--fill`: -> `#E6E9F2`/`#EEF0F7`/`#F7F8FC` (Tex's existing border color; `--fill` reuses the canvas value since Tex never distinguished the two)
- `--ok`/`--ok-bg`, `--danger`/`--danger-bg`, `--amber`/`--amber-bg`: -> Tex's existing status colors and their existing tag-background tints (`#0F7B4D`/`#E6F6EE`, `#C81E1E`/`#FDEAEA`, `#F6A609`/`#FDF0D9`)
- "Blocked" planning-board legend swatch: `#C8BAA0` -> `#9AA2C0` (Tex's pre-existing blocked-status color)
- Two derived FD colors with no token behind them (`.tag.def` and `.ui-toast--info` label, both `#2E7A96`) were changed to `var(--sky)` directly instead of a hand-picked hex, matching Tex's original `.tag.def { color: var(--blue) }` convention.

**Deliberately left unchanged** (not brand tokens, purely decorative): the maintenance/carwash/cleaning/out-of-service block-stripe pattern colors, and muted sidebar meta-text grays (`logo-tag`, `foot-acct`, `foot-by`). These are incidental status/decoration hues independent of the cobalt/coral/navy identity, and Tex's own pre-port CSS made equally arbitrary, independent choices for the same decorative slots.

**Two rule blocks added to `admin.css` that FD's kit has no equivalent for**, since FleetDesk lacks self-serve password reset (`.auth-alt`, styled to match `.auth-card`'s new type scale) and lacks shareable reset links (`.link-row`, styled to match the new `.field`/`.form-grid` input treatment). Both are needed by the Tex-only forgot-password/reset-password/team pages, which were not touched but depend on admin.css.

### Preservation evidence

- **Demo panel + "Enter the live demo" + forgot-password**: `(auth)/login/page.tsx` keeps the `DEMO_MODE` gate, `enterDemo()` handler, and `.demo-panel` block verbatim (including Tex's "sample rentals" wording, not FD's "sample data"), plus `<p className="auth-alt"><a href="/admin/forgot-password">Forgot password?</a></p>` before the error message. Confirmed live via dev-server curl of `/admin/login`: rendered HTML contains `class="demo-panel"`, `Enter the live demo`, `Forgot password?`, zero `fleetdesk` occurrences.
- **Team nav + `/admin/(shell)/team` page**: `side-nav.tsx`'s `LINKS` array has `{ href: "/admin/team", label: "Team" }` inserted between Settings and Policies (Tex's original nav order). `git status` on `(shell)/team/page.tsx` is clean (file untouched); its class usage (`.panel`, `table.grid`, `.tag`, `.row-actions`, `.link-row`, `.btn--quiet`, `.muted`, `.sub`) was checked against the new admin.css; all are defined, including the two new blocks above.
- **Reserve-mode copy**: `RESERVE_MODE` (env `NEXT_PUBLIC_PAYMENT_MODE === "reserve"`) re-applied at 5 sites in `book/page.tsx` (early-return in `submit()` before the Stripe checkout call, the payment-options block gated `!RESERVE_MODE`, the explanatory comment about the unused `paymentOption` default, the "Reserve now" vs "Reserve & pay" button label, and the final-step note text) and 2 sites in `confirmation/page.tsx` (the confirmed and pending/held branches). Tex's exact copy strings were preserved verbatim, not FD's rewording.
- **Tex brand tokens**: see token table above; verified in the actual compiled/served CSS via dev-server curl (`--teal: #15192f`, `--coral: #f15f2c`, `--sky: #2348c7`, `--sand: #f7f8fc` present in the served `layout.css` chunk).
- **Account page reserve label (post-commit catch)**: the brief's reserve grep covered `book/page.tsx` + confirmation only, but old `(public)/account/page.tsx` also carried a `RESERVE_MODE` branch: `STATUS.pending` reads "Awaiting confirmation" in reserve mode instead of "Awaiting payment". The `45cdd1a` wholesale copy dropped it; a systematic sweep of every replaced file's pre-port version for `RESERVE_MODE|DEMO_MODE|tex-cars|Tex Cars` caught it (the only hit not already handled), and the follow-up commit restores it verbatim. The same sweep confirmed no other Tex-specific content was lost anywhere else.
- **Bonus latent-bug fix**: Tex's old wizard linked its terms label to `/policies/rental-terms` (hyphen), but `(public)/policies/[type]/page.tsx` only accepts `rental_terms|cancellation|privacy` and 404s otherwise, so that link was already broken pre-port. The copied wizard links `/policies/rental_terms` (underscore), which matches the route allowlist; kept FD's corrected slug.

## Task 4, wave 01: time foundation port

Commits `2eea63b`..`7220eea` (10 hashes, see the ledger above for each hash's target commit), plus correction commit `f5f7f64` (see Note 8) and the review fix loop `78615e8`/`3ff4ab3`/`9627e05` including the hoisted `69b3889` port (see Note 9). Source: `fleetdesk/main`. Mechanics: individual `git cherry-pick -n <hash>` per commit (not a single whole-file copy like Task 3), conflict-resolved per the playbook, one Tex commit per FD hash. Full detail (per-commit conflicts, test evidence, migration-smoke output, self-review) is in `.superpowers/sdd/task-4-wave01-report.md`; this section is the ledger-adjacent summary.

**Buffer units**: `turnaroundBufferDays` (int, default 1) -> `turnaroundBufferHours` (int, default 24) at the schema/settings/engine layer, landed inside `8a26078`'s own diff (settings schema, `SettingsPatchSchema`, `checkAvailability`, `createBooking`, etc. all renamed together). The brief's specific pointer - a literal `turnaroundBufferDays: 1` in `scripts/seed.ts` - does not exist in Tex's `seed.ts` (it never set this field explicitly; relies on the schema default, which the migration converts automatically). The real Tex-only conversion site is `scripts/seed-demo-bookings.ts` (not touched by any FD wave-01 commit, hand-converted: `settings.turnaroundBufferDays` day-math -> `addHoursIso(endAt, settings.turnaroundBufferHours)`, plus `startDate/endDate/bufferEndDate` -> `startAt/endAt/bufferEndAt` via `atAruba`).

**Other Tex-only structural fixes** (files no FD wave-01 commit touches, but which reference the renamed booking columns and would not compile/run without the rename): `src/test/reservation-mode.test.ts` (one direct `bookings` insert), `src/test/admin-confirm-booking.test.ts` (`makePendingBooking` helper + one direct `reservationConfirmedEmail` call - this Tex-only email function and its `notifyReservationConfirmed` caller in `src/lib/email/notifications.ts` were also hand-updated to the new `startAt/endAt` + `formatDateTime` shape inside `8a26078`, since FD has no equivalent function to carry the rename for us).

**Brand-token conflicts resolved** (beyond the engine/schema auto-merges, which were clean throughout): `admin.css` `.form-grid select:focus` box-shadow (78ca13e) and the new `--pickup`/`--overdue` bar-state tokens + 7-entry planning legend (79da67c) - see the ledger's Task 4 commit list above for exact hex. `date-picker.css`'s new `.scds-dp__select` rules (7220eea) had FD's own `var(--x, #fd-hex)` fallback values rebranded to Tex's tokens, matching the `var(--x, #fallback)` precedent already established in Task 3's token table.

**0016 danger status**: confirmed still exactly as Note 4 describes - fine on fresh local PGlite (migration-smoke green after every wave-01 commit that touches migrations), prod rollout is Task 9's runbook, not executed here.

## Task 4, wave 02: payments redesign, extensions, refunds, cancellation policy, site-config branding

Commits `076b9c5`..`5662406` (13 hashes, see the ledger above for each hash's target commit), plus the journal-guard test commit `2ad3a39` and the docs commit `9cd5687`. Source: `fleetdesk/main`. Mechanics: individual `git cherry-pick -n <hash>` per commit, conflict-resolved per the playbook, one Tex commit per FD hash. Start HEAD: `47c6b52` (wave-01 end). End HEAD after the review fix loop: the docs commit carrying this very update, sitting directly on top of fix-loop commits `eba11fe` and `c504d04` (see the fix-loop section below; a docs commit cannot state its own hash, so the wave's true final commit is `git log -1` on the branch).

### Commit list (start to end)

| # | Hash | Subject |
|---|---|---|
| 1 | `3fa0231` | feat(payments): deposit-or-full money model, amount-paid tracking, desk/extension payment types (port 076b9c5) |
| 2 | `2dc8491` | feat(payments): webhook credits amount paid, verifies against the recorded row, handles extension payments and charge.refunded (port 2859497) |
| 3 | `b9fc0f6` | feat(brand): env-driven site config replaces hardcoded fleetdesk.app in public layout, emails, checkout (port 47d6b52) |
| 4 | `6ea1df6` | feat(payments): pure amounts module, cancellation window policy, admin refunds (port 2a25fba) |
| 5 | `31f458f` | feat(payments): customer cancellation auto-refunds outside the 48h window (port 7cb4a94) |
| 6 | `8a7e3d4` | feat(admin): cancel with explicit refund or no-refund choice (port ef85d53) |
| 7 | `cb99433` | Fix admin cancel dropping policySaysFree from cancellation email (port 55c394d) |
| 8 | `76da12b` | feat(admin): BookingDrawer with payments, balance due, refund and cancel actions (port 7d9c0b1) |
| 9 | `080c520` | fix(admin): scope Escape-close to the topmost overlay only (port 1cbbf02) |
| 10 | `89bbb10` | feat(admin): rental extensions with availability check, delta pricing, link or desk payment (port 7d6d5a3) |
| 11 | `cd3b1ec` | feat(admin): extend rental modal with live delta preview and payment choice (port 80ff41f) |
| 12 | `fee8f3d` | feat(book): honest pay-now step with policy box, persistence and resume payment (port ff407fa) |
| 13 | `864ff53` | feat(book): patient confirmation polling with manual check and WhatsApp fallback (port 5662406) |
| 14 | `2ad3a39` | test(migrations): journal when values strictly increasing (wave-02 review item, not an FD hash) |

Full per-commit conflict/resolution detail, the 0017 hardening decision, the env mapping, reserve-mode preservation evidence, and self-review are in `.superpowers/sdd/task-4-wave02-report.md`; this section is the ledger-adjacent summary.

### Migration 0017

Kept FD's exact filename `drizzle/0017_wave02_money_model.sql` per the MIGRATION RULE. Journal idx 17 appended with the remapped `when`: `1786982009627` (`= 1786970199527 + (1785187850544 - 1785176040444)`, FD's own idx-17 `when`), strictly greater than idx 16's `1786970346316`. `0017_snapshot.json` had the same FD-only/Tex-only table divergence Notes 8/9 found in 0015/0016 (`early_access_leads` present, `admin_reset_tokens` missing) - patched the same way (swap, block copied verbatim from `0014_snapshot.json`, `prevId` chain already correct since FD's own `id` fields were never touched). No hardening commit exists for 0017 in FD's history and none was needed; see Note 10(a) for the full safety analysis and the forward-looking flag for later waves.

### Reserve-mode preservation

Three real gaps found and fixed this wave, all in surfaces this wave's commits rewrote wholesale (no pre-existing Tex branch for git to conflict against, so nothing flagged them automatically):

1. **BookingDrawer dropped the admin "Confirm reservation" action** (`7d9c0b1` deletes the old BoardPopover's BookingPanel, which is where Tex's own `9bb61fa` - predating this port - had added it). Restored as `doConfirm()` in the new Drawer, same route, gated on `status === "pending"`.
2. **`createExtensionCheckout` had no reserve-mode guard** (brand new FD function, FD has no reserve mode to have designed one for). Added the same `env.PAYMENT_MODE === "reserve"` conflict guard `createBookingCheckout` already has (`7d6d5a3`), and hid the "Send payment link" button in the extend modal when `RESERVE_MODE` (`80ff41f`), leaving "Collected at desk" as the only, primary-styled option.
3. **`book/page.tsx`'s new capabilities merged in ungated** (`ff407fa`): the `RESERVE_MODE` early-return skipped the new `clearWizardStorage()` call every other exit path uses; the new sidebar "You pay now: $X" mirror line rendered even in reserve mode, where it is false (nothing is paid online). Both gated to match the rest of the reserve-mode copy.

All 5 pre-wave `RESERVE_MODE` sites (grepped at wave start, per the brief) remain: the module const, the wizard's early-return before any Stripe call, the pay-options gate (now wrapping the full pay-card/policy-box/trust-row block), the submit-button label priority (`RESERVE_MODE` > amounts-driven > fallback), and the final step note. The confirmation page's 4-branch tree (confirmed/pending × reserve/pay) survived `5662406`'s rewrite with both reserve branches' exact copy kept self-contained (not layered with the new webhook-polling UI, since reserve-mode "pending" has no webhook to poll for). `checkout.ts`'s `createBookingCheckout` 409 guard was never touched by any wave-02 commit and remains exactly as wave 01 left it. `src/lib/payments/holds.ts`'s `expireStaleHolds` reserve no-op was untouched by every wave-02 commit (verified: zero diff `52ea88a..HEAD` on that file).

### Test evidence

Baseline before wave-02 work: 50 files / 255 tests, green (confirmed at dispatch start, matching wave-01's end state).

Targeted runs per commit are detailed in `.superpowers/sdd/task-4-wave02-report.md` (every commit got its own targeted run, all green). Explicit full-suite checkpoints (not run after literally every commit, per the brief's "targeted per commit, full suite at wave end" protocol, but run more often than the minimum as insurance after the larger commits): 260 (after commit 1) -> 264 (commit 3) -> 278 (commit 6) -> 281 (commits 8, 9) -> 289 (commit 10) -> 290 (commit 11) -> 291 (commits 12, 13) -> **292 tests / 57 files at wave end** (commit 14, `npm test -- --no-file-parallelism`) - all green, monotonically growing as new test files landed.

`npx tsc --noEmit`: clean at every commit boundary, including the final one.

`npm run lint`: exits 0. Same single pre-existing warning wave 01 already documented as pre-dating both waves (`react-hooks/exhaustive-deps` on the planning board's mount-only `useEffect`) - unrelated to this wave's diffs.

Migration smoke (`DATABASE_URL=pglite://.migration-smoke npm run db:migrate && rm -rf .migration-smoke`): clean, both mid-wave (after `076b9c5` landed 0017) and at wave end. The incremental-upgrade regression test (`src/test/migration-incremental-upgrade.test.ts`, phase 1 through 0014 + phase 2 through the real `DRIZZLE_DIR`, now including 0017) stayed green throughout - the strongest available evidence 0017 is safe on a populated DB, not just a fresh one. The new journal-guard test (same file, static `when`-monotonicity check) is green.

### Self-review findings

Ran a full repo-wide sweep after the last wave-02 commit, before considering the wave done:

1. **`grep -rin fleetdesk src/`**: one hit, `src/test/migration-incremental-upgrade.test.ts`'s `os.tmpdir()` prefix string `"fleetdesk-mig-"` - internal test scaffolding (a throwaway temp-dir name), never rendered anywhere in the app, and pre-dates this wave (added by the hoisted `69b3889` in wave 01). Not user-visible; left as is.
2. **Protected files**: `git diff 52ea88a..HEAD --stat` against `scripts/seed.ts`, `src/env.ts`, `wrangler.jsonc`, `worker/index.ts`, `Dockerfile`, `next.config.ts`, `vercel.json`, `.mcp.json`, the demo door, the password-reset surface, and `src/lib/notify.ts` - all empty. `scripts/seed-demo-bookings.ts` (protected but hand-edit-eligible, same as wave 01's buffer-hours conversion) WAS edited: its `paymentOption` literals and `quote()` call needed the same schema-driven conversion wave 01 made for buffer units, documented under commit 1 in the full report.
3. **`sendOwnerTelegram`/`sendOwnerWhatsApp`**: confirmed present and called at every notify site that had them before this wave (`notifyNewBooking`, `notifyReservationConfirmed`, `notifyBookingConfirmed`). The two brand-new notify functions this wave adds (`notifyBookingCancelled`, `notifyBookingExtended`) never had an owner-ping call to preserve - verified via `git show 47c6b52:src/lib/email/notifications.ts`, neither function existed before this wave, so FD's own scope (notifyAdmin only) is not a regression.
4. **Tex brand tokens**: spot-checked `admin.css`'s `:root` block still reads `--teal: #15192F`, `--coral: #F15F2C`, `--sky: #2348C7` after every commit this wave touched CSS.
5. **No em dashes**: `grep "—"` on every line added to this file caught 2 hits (fixed inline, replaced with the file's own " - " convention). The same check on the 14 wave-02 commit messages caught 2 more, both already committed (`76da12b`, `864ff53`) - not amended, per the binding "always create new commits, never amend" rule; flagged here instead as a minor, purely-cosmetic self-review finding (prose inside commit bodies, not code, comments, or user-visible copy).
6. **`git status --short`** at the end of the dispatch: clean working tree.

### Wave-02 review fix loop (2026-08-19)

The wave-02 review approved the functional code and returned one Important finding plus two minors, all closed here:

| Hash | Subject |
|---|---|
| `eba11fe` | test(payments): cover createExtensionCheckout reserve-mode guard (wave-02 review) |
| `c504d04` | fix(env): blank the site-config example values to match their leave-unset comment (wave-02 review) |
| (this docs commit) | docs(port): wave-02 fix loop, true end HEAD, concerns correction |

1. **Important: the `createExtensionCheckout` reserve-mode guard (checkout.ts:136) had zero test coverage**, and the original report overclaimed that its negative path was "verified". Fixed in `eba11fe`: a new case in `src/test/reservation-mode.test.ts`'s existing "reserve-mode guards" describe, mirroring the sibling `createBookingCheckout` case exactly (PAYMENT_MODE set after `vi.resetModules()` and before the dynamic import, per the file's env rule; asserts the conflict code and /disabled/i message). Verified load-bearing both ways before committing: with the guard temporarily commented out the test fails (`err.code` undefined - the call falls through toward getDb/getStripe); restored, it passes. File now 8/8. The false "verified" sentence in `.superpowers/sdd/task-4-wave02-report.md` was corrected to point at this test.
2. **Minor: `.env.example` was self-contradictory** (comment said leave the site vars unset; two of the three had real values). Fixed in `c504d04`: all three now blank, matching the comment and Note 10(b); real local values stay in gitignored `.env.local`.
3. **Minor: the section intro's "End HEAD: `2ad3a39`" was stale** (it predated even the wave's own docs commit `9cd5687`). Corrected above to the fix-loop shape.

Recorded by the review as accepted-not-fixed (for the final review's awareness): the hardcoded TEXCARS wordmark spans in the public layout and email shell, per the disclosed rationale in commit `b9fc0f6` and Note 10(b) (siteConfig's single plain string cannot represent the two-tone styled mark or the "Tex Cars & Leasing" legal name).

Gates after the fix loop: `reservation-mode.test.ts` 8/8, `reservation-mode.test.ts` + `extend-booking.test.ts` 17/17, `npx tsc --noEmit` clean, full suite 57 files / 293 tests green.

## Task 4, wave 03: vehicle compliance alerts

Commits `c6323f1`..`36f5ee2` (8 hashes, see the ledger above for each hash's target commit), plus the CRON RULE Cloudflare-side commit `2c6c2fb` (not an FD hash) and the self-review fix `010f01c`. Source: `fleetdesk/main`. Mechanics: individual `git cherry-pick -n <hash>` per commit, conflict-resolved per the playbook, one Tex commit per FD hash. Start HEAD: `7f1a813` (wave-02 end). End HEAD: `010f01c`. Full per-commit detail is in `.superpowers/sdd/task-4-wave03-report.md`; this section is the ledger-adjacent summary.

### Commit list (start to end)

| # | Hash | Subject |
|---|---|---|
| 1 | `2894428` | feat(compliance): vehicle expiry dates, alert stages, complianceAlertDays setting (port c6323f1) |
| 2 | `4982b30` | feat(compliance): expiry dates at the vehicle boundary + stage reset on date change (port 0c93851) |
| 3 | `651ada9` | feat(compliance): adminDocumentExpiringEmail template (port 5aa9663) |
| 4 | `487cd24` | feat(compliance): runComplianceAlerts staged 30d/7d/overdue + complianceOverview (port 94c5574) |
| 5 | `adbbcc9` | feat(compliance): daily compliance-alerts cron route + vercel schedule (port 54a24c3) |
| 6 | `2c6c2fb` | feat(ops): Cloudflare cron-keyed dispatch for compliance alerts (CRON RULE, not an FD hash) |
| 7 | `d2071f0` | feat(admin): dashboard compliance card + GET /api/admin/compliance (port 6355620) |
| 8 | `f582a36` | feat(admin): fleet expiry DatePickers + due-soon compliance badges (port 6a2d529) |
| 9 | `475a36a` | feat(admin): compliance first-warning threshold in Settings (port 36f5ee2) |
| 10 | `010f01c` | fix(ops): drop em-dashes from the cron-dispatch comments (self-review, house style) |

### Migration 0018 and the CRON RULE's Cloudflare side

See Note 11 above for both in full: the journal `when` remap (formula-derived `1786995401122`) and snapshot reconciliation (`early_access_leads` swapped for a byte-identical `admin_reset_tokens` block from `0017_snapshot.json`) for `c6323f1`; and the hand-written `wrangler.jsonc` `triggers.crons` + `worker/index.ts` `scheduled()` cron-keyed dispatch for `54a24c3`'s Cloudflare-side counterpart.

### Per-commit conflicts

Three of the eight ledger commits conflicted (all clean, mechanical resolutions - no ambiguity):

1. **`5aa9663` (`src/lib/email/templates.ts`).** Tex's file ends with the Tex-only `passwordResetEmail` (no FD equivalent; FD lacks self-serve reset); FD's commit appends `adminDocumentExpiringEmail` at its own file's end. Resolution: kept both, `passwordResetEmail` first, the new template appended after it. No branding content inside the new function (it renders through the already-Tex-branded `shell()` wrapper).
2. **`54a24c3` (`vercel.json`).** FD's own diff paired the new compliance entry with changing expire-holds from `*/15` to a daily `0 3` schedule. Per the wave-03 amendment, `vercel.json` stays a documentation mirror (the real Tex cron trigger is Cloudflare, not Vercel): kept Tex's `*/15` expire-holds unchanged, added only the `0 9` compliance-alerts entry beside it. FD's expire-holds schedule change was NOT adopted.
3. **`6355620` (`src/app/admin/admin.css`).** `.tag.def` had already been rebranded in Task 3 from FD's raw hex to `var(--sky)` (Task 3's token table); FD's new diff re-added its own raw-hex `.tag.def` alongside the new `.tag.warn` rule (FD's own comment: the amber was "pulled from the board's pending color"). Resolution: kept Tex's token-based `.tag.def`, and pointed the new `.tag.warn` at Tex's existing `--amber`/`--amber-bg` tokens (`.pl-bar--pending` already uses `--amber` for exactly the "pending" semantic FD's comment describes) instead of FD's hardcoded hex, following the same `.tag.on { background: var(--ok-bg); color: var(--ok); }` pattern already established in this file.

The other five ledger commits (`c6323f1`, `0c93851`, `94c5574`, `6a2d529`, `36f5ee2`) applied with zero conflicts; `c6323f1`'s only manual work was the migration journal/snapshot reconciliation (a data-correctness fix, not a merge conflict - `git cherry-pick` reported the journal auto-merge as clean, but clean does not mean correct, see Note 11(a)). Dashboard `page.tsx` (`6355620`) and settings `page.tsx` (`36f5ee2`) both auto-merged cleanly at exactly the anchors the FD wave-03 plan describes, despite the intervening Task 3 redesign and waves 01-02 having touched both files since the plan was written.

### Reserve-mode / protected-surface preservation

Compliance alerts are an entirely new surface (vehicle documents, cron, dashboard card, fleet badges, a settings field) with no reserve-mode-specific behavior to preserve - the wave-03 plan itself notes "`blackout_dates` and booking tables are untouched by this plan", and nothing in the 8 commits touches bookings, checkout, reservation copy, or payment code. Verified via `git diff 7f1a813..HEAD --stat` against every file in the Global Constraints' PROTECTED list (`scripts/seed.ts`, `scripts/seed-demo-bookings.ts`, `src/env.ts`, `Dockerfile`, `next.config.ts`, `.mcp.json`, `.env.local`, the demo-door files, the password-reset surface, `src/lib/notify.ts`): all empty except the two wave-specific authorized edits (`wrangler.jsonc`, `worker/index.ts`, both changed only in the exact CRON RULE way) and `vercel.json` (documentation mirror, per the wave-03 amendment). `sendOwnerTelegram` in `src/lib/notify.ts` is untouched and still exported; `alertOwner()` (also untouched) is the function `runComplianceAlerts` calls, so the compliance path inherits Tex's existing WhatsApp/email owner-alert wiring for free, with no Telegram call to add or break (compliance alerts were never routed through Telegram in FD's own design - `alertOwner` only pushes email + WhatsApp; the Telegram ping is a separate, unrelated Tex-only channel FD doesn't have).

### Test evidence

Baseline before wave-03 work: 57 files / 293 tests, green (matching wave-02's end state).

Targeted runs per commit (all against `src/test/compliance-alerts.test.ts`, growing as each task's tests landed): 3 (commit 1) -> 9 (commit 2) -> 6 in `email-templates.test.ts` (commit 3) -> 19 (commit 4) -> 20 (commit 5, cron route) -> 20 unchanged, cross-checked against `admin-vehicles.test.ts` + `schema-fleet.test.ts` for regressions (commit 8, fleet badges) -> 20 unchanged (commit 9, settings field; no dedicated test per the plan, client-only UI). Commits 6 (Cloudflare cron dispatch) and 7 (dashboard card route) add no tests of their own, matching the FD plan's own test notes for those tasks (`worker/index.ts` is Tex-only infrastructure with no test harness; the admin compliance route is guard-wrapped and, per the FD plan's own stated reason, deliberately not imported into vitest since `requireAdmin` needs a real Next request scope - reused, already-tested guard plumbing covers it).

**Wave-end full suite** (`npm test -- --no-file-parallelism`): **58 files / 314 tests green** (up from 57/293; +1 file for `compliance-alerts.test.ts`, +21 tests: 20 in that file plus 1 new case in `email-templates.test.ts`).

`npx tsc --noEmit`: clean at every commit boundary, including the final one. (`worker/index.ts` is excluded from `tsconfig.json`'s `include` and has no separate typecheck script; see Note 11(b) for how that file was instead verified.)

`npm run lint`: exits 0. Same single pre-existing warning wave-01/02 already documented (`react-hooks/exhaustive-deps` on the planning board's mount-only `useEffect() { void load(); }` at `src/app/admin/(shell)/page.tsx:78`) - confirmed by line number this wave's own new compliance-fetch `useEffect` (added two lines below it, also an empty-dependency-array effect that calls only the stable `apiGet` import, not a closure-scoped function) is NOT the flagged line and introduces no new warning.

Migration smoke (`DATABASE_URL=pglite://.migration-smoke npm run db:migrate && rm -rf .migration-smoke`): clean, both immediately after `c6323f1` (the only migration-bearing commit this wave) and again at wave end. `migration-incremental-upgrade.test.ts`'s phase-2 `migrate()` call now also carries 0018 (it applies the real `DRIZZLE_DIR`), and the file's static journal-monotonicity guard test passed both before and after the `when` remap was applied (it would have failed on the raw FD `when`, see Note 11(a)) - the strongest available evidence the remap is correct, not just internally consistent.

### Self-review findings

Ran a full repo-wide sweep after all 10 wave-03 commits landed, before considering the wave done:

1. **`grep -rin fleetdesk src/`**: two hits, both pre-existing and out of scope for this wave: `migration-incremental-upgrade.test.ts`'s `os.tmpdir()` prefix string `"fleetdesk-mig-"` (flagged and accepted in wave 02's self-review) and `site-config.ts`'s comment `"Fallback defaults below are TEX CARS values, not FleetDesk's..."` (a deliberate, accurate comment explaining the divergence, not a leak). Neither is user-visible; neither was touched or introduced by this wave.
2. **Protected files**: `git diff 7f1a813..HEAD --stat` against every file on the Global Constraints' PROTECTED list is empty, with the two documented wave-specific exceptions (`wrangler.jsonc`, `worker/index.ts` - CRON RULE only) and `vercel.json` (documentation mirror, per the amendment). See the "Reserve-mode / protected-surface preservation" section above for the full list checked.
3. **`sendOwnerTelegram`**: confirmed present, exported, and unmodified in `src/lib/notify.ts`; `alertOwner()` (which `runComplianceAlerts` calls) is likewise untouched. Compliance alerts never called Telegram in FD's own design either, so there is no missing call to restore.
4. **Tex brand tokens**: spot-checked `admin.css`'s `:root` block still reads `--teal: #15192F`, `--coral: #F15F2C`, `--sky: #2348C7`, `--amber: #F6A609` after every commit this wave touched CSS; the new `.tag.warn` rule uses `var(--amber)`/`var(--amber-bg)` rather than a hand-picked hex (see the per-commit conflict note above).
5. **No em dashes**: `git diff 7f1a813..HEAD | grep "^+" | grep "—"` caught two hits in this dispatch's own hand-written comments (the `wrangler.jsonc`/`worker/index.ts` CRON RULE commit, `2c6c2fb`) - fixed in a follow-up commit (`010f01c`) rather than amending, per the no-amend rule (see Note 11(b)). Pre-existing em-dashes already in those same files from before this wave (the file's original header comment) were left untouched as out of scope. The same check on every line this wave added to `docs/PORT-LOG.md` and on all 10 commit messages found no further hits.
6. **`git status --short`** at the end of the dispatch: clean working tree.

Gates after the wave: full suite 58 files / 314 tests green, `npx tsc --noEmit` clean, `npm run lint` clean (one pre-existing warning), migration smoke clean, working tree clean.

## Concerns / notes for later waves

- The extension "send payment link" flow was never exercised against a real Stripe test-mode checkout in this dispatch (no dev server, no live Stripe call per the binding constraints). Coverage is unit/integration-level: `extend-booking.test.ts`'s mocked Stripe client for the happy path, and (since the review fix loop, commit `eba11fe`) a dedicated reserve-mode guard test in `reservation-mode.test.ts`. Task 7's full-gate manual smoke should include an extension paid by link.
- Note 10(a)'s forward-looking flag: if a later wave's migration references `payment_type`'s new values (`rental_deposit`/`rental_full`/`extension`) in a CHECK constraint, partial index, or exclusion predicate, re-run the same-transaction-unsafe-use check before assuming `ALTER TYPE ... ADD VALUE` is safe - 0017 itself was clean, but the next migration to touch this enum might not be.
- **New (wave 03):** the compliance dashboard card, fleet badges, and settings field were verified by code review + full suite + migration smoke only - no manual `npm run dev` walk was done this dispatch (no dev server, per the binding constraints). Task 7's full-gate manual smoke should include: set a vehicle's insurance/inspection date inside the warning window via the Fleet form and confirm the amber badge + dashboard card render, set a past date and confirm the red "overdue" variant, and confirm the compliance-alerts cron actually fires end to end once Cloudflare secrets exist (Task 9's runbook item below).
- **New (wave 03):** `runComplianceAlerts` was only exercised through vitest's PGlite path with the WhatsApp/Resend env unset (best-effort no-op, matching the FD plan's own test note). The real owner-facing email + WhatsApp content has never rendered against a live Resend/WhatsApp send in this port. Task 7's full-gate manual smoke should trigger one real compliance alert (a vehicle dated a few days inside the warning window) against dev credentials if available, or explicitly defer that check to Task 9's live rollout.
- **New (wave 03):** the Cloudflare cron dispatch (`wrangler.jsonc` + `worker/index.ts`) has never run against a real Cloudflare Worker (deploy is forbidden by the binding constraints). Verification was code review + verbatim match against the plan's block only. Task 9's runbook step "verify crons fired (`*/15` expire-holds, `0 9` compliance)" is the first point this actually gets exercised live.
- Task 9's runbook (above) now carries the `NEXT_PUBLIC_SITE_NAME`/`NEXT_PUBLIC_SITE_URL`/`NEXT_PUBLIC_WHATSAPP_NUMBER` Dockerfile + wrangler.jsonc items alongside the wave-01 storage vars and the 0016 downtime note; nothing in this list has been executed.
- No other blockers. Full suite green (314 tests), tsc clean, lint clean (one pre-existing warning), migration smoke clean, working tree clean.
