# FleetDesk Parity Port v2 (Tex Cars) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the LIVE tex-cars-app up to FleetDesk's August level (the 2026-07 waves 01-08, breakdown swap, day-zoom hour grid, mobile pass, Sand and Surf admin kit re-branded to Tex) while preserving every Tex-only feature (reserve mode, admin password reset and team panel, owner Telegram ping, Cloudflare Container deploy glue, real fleet seed, Tex branding).

**Architecture:** This plan is the control document. It executes the companion plan `2026-07-27-wave-09-tex-port.md` (same folder; its conflict playbook applies to every apply step here) with the August amendments listed per task, then adds new tasks for the post-wave FleetDesk features. Port mechanics: cherry-pick FD commits in original order from a local `fleetdesk` remote pinned at FD `main` @ `c96405a`.

**Tech Stack:** git cherry-pick across unrelated-history repos, Next.js 15, drizzle migrations on PGlite locally, vitest, Cloudflare Containers glue (worker/index.ts + wrangler.jsonc).

## Global Constraints

- TEX repo: `/Users/monischahieroms/Desktop/SaltyCode/03-Clients/saltycodestudio-clients/tex-cars-rental/app`, branch `feat/fleetdesk-parity` off main @ `6d46a9d`. FD repo: `/Users/monischahieroms/Desktop/SaltyCode/04-Products/saltycodestudio-products/fleetdesk`, port source = `main` @ `c96405a`.
- HARD SAFETY RAILS: never deploy (`wrangler deploy`, `docker`, `crane` all forbidden), never touch the prod DB (Supabase `fnqdplvwokijbqmjhawd`), never push to origin, never merge to main. Everything stays on the local branch; Mo reviews before anything ships.
- Tests: `npm test -- --no-file-parallelism` (baseline 221 green). NEVER `npm run build` while a dev server runs. PGlite `.dev-db` is single-writer: stop any dev server before running db scripts.
- PROTECTED TEX FILES, hand-merge only, never overwritten by a copy: `scripts/seed.ts` (real 34-car fleet), `scripts/seed-demo-bookings.ts`, `src/env.ts`, `wrangler.jsonc`, `worker/index.ts`, `Dockerfile`, `next.config.ts` (DOCKER_BUILD hatch), `vercel.json`, `sendOwnerTelegram` in `src/lib/notify.ts`, the password-reset surface (`src/lib/db/schema/admin-reset-tokens.ts`, `src/app/api/admin/auth/reset/**`, `src/app/api/admin/users/**`, `admin/(auth)/forgot-password`, `admin/(auth)/reset-password`, `admin/(shell)/team`), the demo door (`src/lib/auth/demo.ts`, `api/admin/auth/demo`, the login-page demo panel), reserve-mode semantics (`confirmBookingAdmin`, holds no-op, `NEXT_PUBLIC_PAYMENT_MODE` boot check), `.env.local`, `.mcp.json`.
- BRANDING: Tex `:root` tokens stay cobalt `#2348c7` / coral `#f15f2c` / navy `#15192f`. Copied FD CSS that references raw `--sand/--teal/--coral` gets repointed to Tex tokens. `grep -ri fleetdesk src/` must end at comments only.
- ENV RULE: every env var a ported feature introduces MUST also be appended to `CONTAINER_ENV_KEYS` in `worker/index.ts`, or it silently never reaches the container.
- CRON RULE: every ported cron endpoint needs a Cloudflare trigger: an expression in `wrangler.jsonc` `triggers.crons` AND a dispatch branch in `worker/index.ts` `scheduled()` keyed on `controller.cron` (code in Task 4).
- MIGRATION RULE (supersedes wave-09 playbook item 5): TEX journal idx 0 to 14 is fixed; idx 14 = `0014_majestic_sunspot` (admin_reset_tokens). FD `0014_hot_mesmero` (leads) is NEVER ported. FD `0015` to `0024` keep their exact file names and numbers in TEX; append `drizzle/meta/_journal.json` entries idx 15 onward with the FD tags in FD order, preserving each FD `when` value, and copy the matching `drizzle/meta/*_snapshot.json` semantics by running the migration-smoke after every wave: `DATABASE_URL=pglite://.migration-smoke npm run db:migrate && rm -rf .migration-smoke` → exits clean.
- FD `0016_high_gladiator` is PROD-DANGEROUS (bookings `date` → `timestamptz` with a 09:00 America/Aruba backfill and a gist constraint rebuild). It is fine on fresh local PGlite. Mark it in the port ledger; the live-data rehearsal lives in Task 9's runbook and is NOT executed by this plan.
- Copy stays dash free everywhere (no em-dashes, no double hyphens in prose).

---

### Task 1: Remote, baseline, port ledger (wave-09 Task 1, amended)

**Files:**
- Create: `docs/PORT-LOG.md`

**Interfaces:**
- Produces: `fleetdesk` git remote fetched; a decision-tagged ledger of every FD commit; proven 221-test green baseline.

Amendments to wave-09 Task 1: the FD source is `main` (c96405a), not `feat/wave-2026-07`; the baseline is 221 tests, not 186; the branch `feat/fleetdesk-parity` already exists.

- [ ] `git remote add fleetdesk /Users/monischahieroms/Desktop/SaltyCode/04-Products/saltycodestudio-products/fleetdesk && git fetch fleetdesk main` → `fleetdesk/main` visible.
- [ ] Baseline: `npm test -- --no-file-parallelism` → 221 tests green. If red, STOP and fix before porting.
- [ ] Build the ledger: `git log --oneline --reverse fleetdesk/main` into `docs/PORT-LOG.md` with columns hash / subject / decision. Pre-filled decisions: `a288900` skip (marketing funnel), `f525d5a` skip (early-access CSRF), `5af8b32` skip (demo door, Tex has its own), every docs-only commit skip, `0014_hot_mesmero` skip wherever it appears, all desk-mode approval commits (the `feat/desk-mode-telegram-approval` merge lineage ending at `7813bcc` plus `c96405a`) marked `defer-task-8`, everything else `port` in order. Add a "Backport candidates to FleetDesk" footer listing: admin forgot-password + team panel, `sendOwnerTelegram` owner ping.
- [ ] Commit: `git add docs/ && git commit -m "chore(port): fleetdesk remote, port ledger, companion plans"`

### Task 2: Security fixes + Next 15.5.20 (wave-09 Task 2, amended)

Execute wave-09 Task 2 exactly as written (cherry-pick `32b6ea4` then `1e0c855`, then `npm install next@15.5.20 eslint-config-next@15.5.20`, `rm -rf .next && npm run build`), with these amendments:

- Conflicts inside guest booking/checkout routes must preserve Tex's reserve-mode gating (checkout 409 in reserve mode) and the `NEXT_PUBLIC_PAYMENT_MODE` boot check in `src/env.ts`.
- The Cloudflare container image rebuild after the Next bump is deliberately NOT done here; it is a Task 9 runbook item. Local `npm run build` green is this task's gate.
- Keep `next.config.ts`'s `DOCKER_BUILD=1` typecheck/lint hatch untouched.

### Task 3: Admin kit + Sand and Surf admin + booking wizard (wave-09 Task 3, amended)

Execute wave-09 Task 3 as written (whole-file copies from FD revision `713c11c`), with these amendments:

- Do NOT drop `DEMO_MODE` blocks: Tex now has its own demo door. `admin/(auth)/login/page.tsx` is a hand-merge that keeps Tex's demo panel and forgot-password link.
- `admin.css`: copy FD's file, then restore Tex `:root` brand values (cobalt `#2348c7`, coral `#f15f2c`, navy `#15192f`, Tex canvas) and repoint any raw `--sand/--teal/--coral` references to the Tex tokens.
- `src/app/(public)/book/page.tsx` and the confirmation page: before copying, `grep -n "reserve" src/app/(public)/book/page.tsx src/app/(public)/book/confirmation/*.tsx` and save the reserve-mode copy branches; re-apply them onto the copied wizard so reserve customers still see reservation language and no payment step. This is the trickiest hand-merge of the task; the full suite plus a manual `/book` walk in reserve mode is the gate.
- Preserve the Team nav item (password-reset feature) in the copied `side-nav.tsx`.

### Task 4: Waves 01 to 08 (wave-09 Task 4, amended)

Execute wave-09 Task 4 (cherry-pick wave commits in ledger order, full suite at each wave boundary), with these amendments:

- Migrations follow the Global MIGRATION RULE (keep FD numbers 0015 to 0023 here; 0024 belongs to Task 8). Run the migration-smoke after every wave.
- Buffer units: wave 01 switches `turnaroundBufferDays` to `turnaroundBufferHours`. Hand-edit `scripts/seed.ts` (protected): the current `turnaroundBufferDays: 1` becomes `turnaroundBufferHours: 24`. Any Tex test fixture using days converts the same way.
- Wave 03 cron: add the compliance trigger per the CRON RULE. `wrangler.jsonc` crons become `["*/15 * * * *", "0 9 * * *"]` and `worker/index.ts` `scheduled()` becomes a cron-keyed dispatch:

```ts
async scheduled(
  controller: ScheduledController,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  const jobs: Record<string, string> = {
    "*/15 * * * *": "/api/cron/expire-holds",
    "0 9 * * *": "/api/cron/compliance-alerts",
  };
  const path = jobs[controller.cron];
  if (!path) return;
  const run = async (): Promise<void> => {
    const container = getContainer(env.CONTAINER, INSTANCE_ID);
    const secret = typeof env.CRON_SECRET === "string" ? env.CRON_SECRET : "";
    const res = await container.containerFetch(
      new Request(`http://container${path}`, {
        headers: { authorization: `Bearer ${secret}` },
      }),
      3000,
    );
    if (!res.ok) {
      console.error(`cron ${path} failed: HTTP ${res.status}`);
    }
  };
  ctx.waitUntil(run());
}
```

- `vercel.json` stays a documentation mirror: keep `*/15` expire-holds and add the daily compliance entry beside it.
- Wave 06 storage: dev uses `STORAGE_DRIVER=local`. Append `STORAGE_DRIVER`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_BUCKET`, `LOCAL_STORAGE_DIR` to `CONTAINER_ENV_KEYS` now (the forwarder skips empty values, so this is safe before the bucket exists). Bucket provisioning is a Task 9 runbook item.
- Wave 08 gate addition: after staff logins land, verify the Tex owner account and the Tex demo door both still log in locally.

### Task 5: Post-wave FleetDesk features: breakdown swap, day-zoom hour grid, mobile pass

**Files:**
- Create (from FD): `src/lib/admin/swap-vehicle.ts`, `src/lib/admin/hour-grid.ts`, `src/lib/admin/bar-span.ts`, `src/lib/admin/drag-click-guard.ts`, route `src/app/api/admin/bookings/[id]/swap-vehicle/route.ts`, matching `src/test/*` files
- Modify: `src/app/admin/(shell)/page.tsx` (planning board), `src/app/admin/admin.css` (mobile pass rules), `src/app/(public)/book/*` (public stepper mobile fixes)

**Interfaces:**
- Consumes: ledger entries between the wave-08 tail and the desk-mode lineage (the swap, hour-grid, mobile-pass and pricing-copy commits on `fleetdesk/main`).
- Produces: Tex planning board with day-zoom and swap; admin usable at 390/768/1024 widths.

- [ ] From the ledger, cherry-pick in order every remaining `port` commit that is not desk-mode (`defer-task-8`) and not marketing/pricing-page cosmetic (`skip`, for example FD's "Early-access pricing" marketing edits which have no Tex equivalent page).
- [ ] Planning-board conflicts: Tex's board carries the reserve-mode "Confirm reservation" button and panel wiring (`9bb61fa`); every board conflict resolves by keeping BOTH the FD feature hunk and the Tex confirm surface.
- [ ] Suite green at each commit group; full suite plus `npx tsc --noEmit` at the end.
- [ ] Manual smoke: day header click zooms to the hour grid; drag a bar; swap a booking to another car and see the repair-block prompt; resize to 390px and confirm the admin top bar and tables behave.
- [ ] Commit per ported group, reusing FD subjects with ` (port <hash>)` suffix.

### Task 6: Tex data and settings (wave-09 Task 5, amended)

Execute wave-09 Task 5 as written (retire the four A-plate Suzukis `A-71203`, `A-68405`, `A-21141`, `A-67530`; backfill make/model/year/color; settings defaults), with these amendments:

- Settings values: `minDriverAge` stays at Tex's current production value (read it from the live settings row semantics in `scripts/seed.ts` before editing; the wave-09 suggestion of 18 is NOT applied without the owner's say; note it in PORT-LOG for the owner).
- `turnaroundBufferHours: 24` per Task 4's unit change.
- Add a PORT-LOG note listing every setting the owner should confirm: young driver age and fee, cancellation window, deposit percent, opening and closing times.

### Task 7: Full gate in Tex branding (wave-09 Task 6, amended)

Execute wave-09 Task 6 as written, with these additions to the manual smoke list:

- Reserve mode end to end: `/book` shows reservation copy and no payment step; booking lands pending; admin Confirm flips it and the customer email uses reservation language.
- Forgot-password: request a reset from the login page (dev shows the flow without Resend), and the Team panel mints a reset link.
- Demo door still enters the dashboard with `DEMO_MODE=true` in `.env.local`.
- Swap and day-zoom behaviors from Task 5.
- Deep link `/book?class=Economy&pickup=2026-08-25&return=2026-08-27` works.
- `grep -ri fleetdesk src/ | grep -v "//"` returns nothing user-visible.
- Final commit `"docs(port): parity complete, go-live env notes"` and STOP. Do NOT merge or deploy; the branch is presented to Mo.

### Task 8: Desk-mode decision memo (docs only, gated on Mo)

**Files:**
- Create: `docs/superpowers/specs/2026-08-18-tex-desk-vs-reserve-decision.md`

**Interfaces:**
- Produces: a one-page decision memo for Mo. NO desk-mode code is ported by this plan.

- [ ] Write the memo covering: what Tex reserve mode does today (admin Confirm + single-chat owner ping, PAYMENT_MODE reserve baked into the container image via NEXT_PUBLIC_PAYMENT_MODE); what FD desk mode adds (multi-manager Telegram bot with Confirm/Decline buttons, first-tap-wins, email fallback approval page, reminders cron, migration 0024, `telegram:setup` runbook); the three options: A keep reserve as is, B adopt desk mode fully at the next owner touchpoint (needs a BotFather bot, manager linking, env changes, container rebuild, migration 0024 on prod), C desk engine with the owner as the single manager. Include the env mapping table (reserve → desk, stripe → online) and the fact that changing the mode requires a redeploy because NEXT_PUBLIC_PAYMENT_MODE is baked at image build.
- [ ] Recommendation to state in the memo: B at the next planned owner session, A until then.
- [ ] Commit: `git add docs/superpowers/specs && git commit -m "docs(desk): desk vs reserve decision memo for Mo"`

### Task 9: Prod parity rollout runbook (docs only, NO execution)

**Files:**
- Create: `GO-LIVE-PARITY.md` (repo root, beside GO-LIVE-RUNBOOK.md conventions)

**Interfaces:**
- Produces: the exact operator sequence to take the parity branch live LATER, with Mo. Nothing in it runs now.

- [ ] Write the runbook: 1. pg_dump backup over the session pooler; 2. apply migrations 0015 to 0023 to prod in order with the 0016 downtime note (date to timestamptz backfill at 09:00 America/Aruba; verify buffer recompute and spot-check real bookings after); 3. provision the private Supabase storage bucket + `STORAGE_*` env; 4. add new vars/secrets on the worker (they are already in `CONTAINER_ENV_KEYS`); 5. rebuild + push the container image via the crane path documented in the go-live gotcha; 6. `wrangler deploy`; 7. verify crons fired (`*/15` expire-holds, `0 9` compliance); 8. rollback notes: previous image tag redeploy restores code, 0016 is NOT reversible in place, restore from the dump.
- [ ] Commit: `git add GO-LIVE-PARITY.md && git commit -m "docs(runbook): parity rollout runbook, execute only with Mo"`

## Self-review

- Coverage: "port the FleetDesk 8-wave improvements + redesigned admin look" = Tasks 2 to 5; "mind: Tex has reservation-mode + password-reset that FleetDesk lacks" = Global protected files + Task 1 backport footer; desk mode deliberately gated = Task 8; live prod safety = rails + Task 9.
- The only intentionally-not-planned code is desk-mode porting (Task 8 output decides it) and prod execution (Task 9 output guides it).
