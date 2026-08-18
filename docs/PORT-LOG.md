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
