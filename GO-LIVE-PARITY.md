# Tex Cars Go-Live Parity Rollout (FleetDesk Parity Port)

Date: 2026-08-19 · Owner: Salty Code (managed) · Client asset: domain + Stripe
Branch: `feat/fleetdesk-parity` · Companion docs: `docs/PORT-LOG.md` (full
migration/settings detail), `docs/superpowers/plans/2026-08-18-fleetdesk-parity-port-v2.md`
(the plan this executes), `GO-LIVE-RUNBOOK.md` one level up (the original
Phase 2 go-live runbook: accounts, secrets, first deploy).

> **This runbook is executed only together with Mo, never autonomously.**
> Nothing below has been run. Every command here is written for a human to
> read, decide on, and run by hand with Mo present, not for an agent to
> execute unattended. `wrangler deploy`, `docker`, and `crane` stay forbidden
> outside this session, exactly as the port plan's Global Constraints say.

---

## 0. Read this first

- **Prerequisite:** this branch has passed Task 7's full gate (492/492 tests,
  `tsc` clean, lint 0 errors with 4 pre-existing warnings, build green, 23/23 HTTP smoke) and Mo's own review
  of the working branch. If any commit has landed on `feat/fleetdesk-parity`
  since that gate ran, rerun it before starting this runbook.
- **Scope:** this document is the delta on top of `GO-LIVE-RUNBOOK.md`, not a
  replacement for it. It assumes the accounts, secrets, and first deploy in
  that runbook's sections 1-9 already happened at some point (Supabase,
  Upstash, Stripe, Resend, Cloudflare Workers Paid, the worker's first
  `wrangler deploy`). If Tex Cars has never been deployed at all, run
  `GO-LIVE-RUNBOOK.md` sections 1-9 first, against this parity branch instead
  of `main`, then come back here for the delta.
- **Before step 1, confirm which starting state prod is actually in** (they
  need different care and this runbook does not assume either one):
  - **Fresh**: `app.tex-cars.com` (or its `workers.dev` fallback) has never
    taken a real booking; the DB may be unmigrated or only partway through
    `0000`-`0014`.
  - **Live-ish**: `GO-LIVE-RUNBOOK.md`'s steps ran at some point; there may
    already be real `settings` / `vehicles` / `bookings` rows in prod.
  Check with a read-only query before touching anything (step 1 below). The
  seed no-retro-apply caveat in the rollback section matters only in the
  live-ish case.
- **Out of scope for this pass:** FleetDesk desk mode (migration `0024`, the
  Telegram approval bot). That is Task 8's decision
  (`docs/superpowers/specs/2026-08-18-tex-desk-vs-reserve-decision.md`), not
  yet made. If Mo chooses to adopt it, that is a follow-up addendum to this
  runbook, not a silent extra step here.

---

## 1. Confirm current state, then back up

From `app/`, with the **session pooler** connection loaded (`:5432`, matches
`GO-LIVE-RUNBOOK.md` §4's `DATABASE_MIGRATION_URL`, IPv4-friendly, allows DDL):

```bash
export DATABASE_MIGRATION_URL='postgres://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require'
```

Check the real migration state (read-only, drizzle's own tracking table):

```bash
psql "$DATABASE_MIGRATION_URL" -c "select id, hash, created_at from drizzle.__drizzle_migrations order by created_at desc limit 5;"
```

If that table or schema does not exist yet, prod is at the "fresh, unmigrated"
end of the spectrum; see §0. Otherwise, note the latest applied migration and
sanity-check it against `drizzle/meta/_journal.json`'s entries (`idx 14`,
`0014_majestic_sunspot`, is Tex's own pre-parity baseline).

Back up before anything else:

```bash
pg_dump "$DATABASE_MIGRATION_URL" -Fc -f "tex-cars-prod-$(date +%Y%m%d-%H%M).dump"
```

Keep this dump until step 8's rollback window has fully passed. This is the
only real undo for a bad `0016` apply (see step 2 and step 8).

---

## 2. Apply migrations `0015` to `0023` (staged, with the `0016` downtime note)

Run through the app's own migrator, never by hand-running the `.sql` files
with `psql`:

```bash
export DATABASE_URL='postgres://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require'
# plus the other required vars so env validation passes (SESSION_SECRET,
# DATA_ENCRYPTION_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, APP_ORIGIN,
# CORS_ALLOWED_ORIGINS, NODE_ENV=production), same shape as GO-LIVE-RUNBOOK.md §6
npm run db:migrate
```

**Why "never by hand":** `npm run db:migrate` applies every pending migration
in ONE transaction (drizzle's stock migrator). `0015` was specifically
rewritten as an in-transaction enum type-swap (not `ALTER TYPE ... ADD VALUE`)
to avoid a `55P04 "unsafe use of new value"` error on an already-populated DB
(`docs/PORT-LOG.md` Notes 8-9). Separately, every appended journal entry from
`0015` onward was hand-remapped to a `when` value strictly above Tex's own
`idx 14` entry, so drizzle's migrator does not silently skip the whole batch
on a DB already migrated through `0014` (Note 9(b)'s formula; this was a real,
reproduced bug before the fix, not a theoretical one). Both protections live
in the committed `drizzle/meta/_journal.json` and only work through the real
migrator. Because the whole batch is one transaction, a failure anywhere in
`0015`-`0023` rolls back the entire batch cleanly; there is no partially
applied state to clean up if something goes wrong mid-run.

**The `0016` downtime note.** `drizzle/0016_high_gladiator.sql` converts
`bookings` (`start_at`/`end_at`/`buffer_end_at`) and `availability_blocks`
(`start_at`/`end_at`) from `date` to `timestamptz`, backfilling existing
booking rows at `09:00` **America/Aruba** wall time (availability blocks are
cast at Aruba midnight on their original dates), converts
`settings.turnaround_buffer_days` to `turnaround_buffer_hours` (`x24`), and
drops and rebuilds the `bookings_no_overlap` `gist` exclusion constraint on
the new timestamptz columns. The `ALTER TABLE` and constraint rebuild lock the
`bookings` table for the duration. On Tex's real fleet and booking volume this
should be seconds, not minutes, but run this whole batch in a quiet window
anyway (overnight Aruba time, no active checkouts) and treat the booking site
as briefly unavailable for new submissions while it runs.

**After the migration, before moving on:**
- Re-run the state check from step 1; confirm the journal now ends at
  `0023_exotic_storm`.
- Spot-check a handful of real pre-existing bookings: `start_at`/`end_at`
  should read as `09:00` Aruba time on the original date, and the planning
  board should still show them on the same day with no gap or overlap.
- Confirm the buffer recompute: pick one vehicle's `settings`-driven buffer
  and confirm `buffer_end_at` on a recent booking is `end_at` plus the new
  `turnaround_buffer_hours`, not the old day-based value silently carried
  over wrong.
- `npm run db:migrate` again (idempotent no-op expected: nothing pending).

---

## 3. Provision the Supabase storage bucket (HARD BLOCKER)

**This step blocks go-live for check-in/check-out specifically, not the rest
of the app, and it is not optional.** Without it, prod boots on the fail-safe
`STORAGE_DRIVER=local` default, which does **not** persist across container
restarts or redeploys. Every check-in photo, driver's licence copy,
signature, and generated contract PDF would be silently lost on the very next
redeploy, with the database rows still pointing at storage keys that no
longer exist. Do this before step 5's rebuild, not after.

1. Supabase dashboard -> Storage -> New bucket. **"Public bucket" OFF.**
   Default name `fleet-docs` (matches `STORAGE_BUCKET`'s schema default, so
   `STORAGE_BUCKET` does not need to be set unless a different name is
   chosen).
2. Set on the worker (see step 4 for secret vs. var):
   - `STORAGE_DRIVER=supabase`
   - `SUPABASE_URL` (the project URL, same project as `DATABASE_URL`)
   - `SUPABASE_SERVICE_ROLE_KEY` (**service-role**, not anon; this key can
     read/write the private bucket regardless of RLS, so it is a secret)
   - `STORAGE_BUCKET` only if the bucket is not named `fleet-docs`

All five keys are already forwarded by `CONTAINER_ENV_KEYS` in
`worker/index.ts`, so this step needs no code change, only the bucket itself
and the real values.

---

## 4. Env vars and secrets on the worker

Everything below is already in `CONTAINER_ENV_KEYS` EXCEPT the
`NEXT_PUBLIC_SITE_*` trio, which is deliberately not forwarded (those values
are baked in at build time, see below). Nothing here needs a code change
except the Dockerfile items flagged explicitly.

| Var | Secret or plain var | Status |
|---|---|---|
| `STORAGE_DRIVER`, `STORAGE_BUCKET`, `SUPABASE_URL` | plain `vars` (none secret in isolation without the service-role key) | new this port, from step 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | `wrangler secret put` | new this port, from step 3 |
| `PAYMENT_MODE`, `NEXT_PUBLIC_PAYMENT_MODE` | plain `vars`, already `"reserve"`/`"reserve"` in `wrangler.jsonc` | unchanged by this port unless Task 8 has since decided B/C |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | `wrangler secret put` | Tex's pre-existing single-chat owner ping; unrelated to Task 8's desk-mode decision unless/until that lands |
| `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WHATSAPP_NUMBER` | Dockerfile build-time `ENV` only (see below) | new this port |

**The `NEXT_PUBLIC_SITE_*` trio is a Dockerfile edit, nothing else.** These
are `NEXT_PUBLIC_*` vars, so Next.js inlines them into the client bundle at
`next build` time, the same mechanism `NEXT_PUBLIC_PAYMENT_MODE` already uses
(Dockerfile lines 57-68), and a Dockerfile `ENV` also stays visible to the
server process at runtime, so the one edit covers both sides. A
`wrangler.jsonc` `vars` entry would do nothing here: the trio is not in
`CONTAINER_ENV_KEYS`, so a worker var never reaches the app process, and it
could not reach the already-built client JS anyway. Do not add them to
`CONTAINER_ENV_KEYS` either; a rebuild is the only honest way to change them.
Before step 5's rebuild:

1. Add real values as new `ENV` lines in the Dockerfile's builder stage,
   right beside the existing `NEXT_PUBLIC_PAYMENT_MODE` line:
   `NEXT_PUBLIC_SITE_NAME=Tex Cars`, `NEXT_PUBLIC_SITE_URL=https://tex-cars.com`,
   `NEXT_PUBLIC_WHATSAPP_NUMBER=2975945454` (E.164 digits, no `+`, sourced
   from `site/data/config.js`'s `waNumber`).
2. Note that until those values ever change, even step 1 changes nothing
   visible: the in-code fallbacks in `src/lib/site-config.ts` are already the
   same real Tex values.

If `docs/superpowers/specs/2026-08-18-tex-desk-vs-reserve-decision.md` has
since been decided and Option B or C is underway, that work adds its own env
vars (`TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, and whatever the
`PAYMENT_MODE` literal ends up being) and its own migration `0024`. None of
that is folded into this runbook; treat it as a follow-up pass using this same
shape (bucket-style hard-blocker check, Dockerfile bake if it touches
`NEXT_PUBLIC_*`, migration staged the same careful way as step 2).

---

## 5. Rebuild and push the container image (crane path)

Cloudflare only runs `linux/amd64` images, and this laptop's Docker runs
through Colima, whose NAT kills large registry uploads directly from
`wrangler deploy`'s own build-and-push path. `wrangler.jsonc`'s
`containers[0].image` already points at a **pre-pushed** registry image
rather than `"./Dockerfile"`, with the reason recorded right there in a
comment: build with `wrangler containers build`, `docker save`, then
`crane push`, from the host network.

```bash
# 1. build the amd64 image locally (picks up the Dockerfile edits from step 4)
npx wrangler containers build -t tex-cars-app:parity-<yyyymmdd> .

# 2. save it to a tarball crane can push from the host network
docker save tex-cars-app:parity-<yyyymmdd> -o tex-cars-app.tar

# 3. push to the same registry wrangler.jsonc already references, under a
#    NEW tag (do not silently overwrite :golive - step 8's rollback needs a
#    previous tag to redeploy TO)
crane push tex-cars-app.tar registry.cloudflare.com/8cd6b08425f14fe7e1f52e4a10109545/tex-cars-app:parity-<yyyymmdd>
```

No prior session captured the exact flags for these three commands as a
script; confirm each tool's current `--help` output against the Cloudflare
Containers docs at execution time rather than trusting the sketch above
verbatim. After the push, update `wrangler.jsonc`'s `containers[0].image` to
the new tag and commit that change on its own.

Do this whole step **after** step 4's Dockerfile edits, in the same pass, so
whatever `PAYMENT_MODE`/`NEXT_PUBLIC_*` values are current at the time
actually end up baked into the image being pushed, not a stale image someone
built earlier in the day.

---

## 6. `wrangler deploy`

```bash
npx wrangler deploy
```

Picks up the new container image reference, the `vars` block edits from
step 3/4, and the cron `triggers` (unchanged this port: `*/15 * * * *` and
`0 9 * * *`, already in `wrangler.jsonc`).

---

## 7. Verify both cron schedules fired

- `*/15 * * * *` (hold-expiry, pre-existing): Cloudflare dashboard -> Worker ->
  Cron / logs, or trigger it directly: `curl -H "Authorization: Bearer
  $CRON_SECRET" https://app.tex-cars.com/api/cron/expire-holds`.
- `0 9 * * *` (daily compliance alerts, this port's addition): same dashboard
  check, or `curl -H "Authorization: Bearer $CRON_SECRET"
  https://app.tex-cars.com/api/cron/compliance-alerts` -> expect
  `{"ok":true,"fired":N}`. A bare request with no bearer should `401`
  (fail-closed, verified in Task 7's gate).
- Neither cron has ever run against a real Cloudflare Worker before this
  rollout (forbidden by the port plan's binding constraints throughout
  Tasks 1-7); this is the first real exercise of both.

---

## 8. Rollback notes

- **Code:** redeploy the previous image tag (this is why step 5 pushes under
  a new tag instead of overwriting `:golive`). `wrangler.jsonc`'s
  `containers[0].image` back to the old tag, `wrangler deploy` again.
- **`0016` is NOT reversible in place.** Once the migration batch commits,
  there is no clean "convert timestamptz back to date" undo: the Aruba
  wall-time interpretation would have to be reversed exactly, and any booking
  written or edited after the migration would be lost by that reversal. The
  only real rollback for a bad `0016` apply is restoring the step 1 dump, not
  a forward-fix migration.
- **Seed no-retro-apply caveat.** `scripts/seed.ts`'s inserts use
  `onConflictDoNothing` (`settings` on `id`, `vehicles` on `slug`). If prod
  was in the **live-ish** state from step 0 (rows already existed before this
  rollout), re-running `npm run db:seed` will **not** retroactively apply
  Task 6's changes to those existing rows: not the four retired plates
  (`A-71203`, `A-68405`, `A-21141`, `A-67530`), not the make/model/year/color
  backfill, not the nine now-explicit settings values. `onConflictDoNothing`
  only fills gaps on rows that do not exist yet; it silently no-ops on rows
  that do. If prod is live-ish, those changes need a one-off `UPDATE` pass
  (or a dedicated data migration) written by reading Task 6's actual `FLEET`
  diff in `scripts/seed.ts` and `docs/PORT-LOG.md`'s Task 6 section first, so
  the values applied match exactly rather than being guessed fresh. That pass
  is explicitly **not** part of this runbook.

---

## 9. Before taking real bookings

- Confirm the "Owner settings to confirm" list with Mo
  (`docs/PORT-LOG.md`) before treating any seed default as final:
  `minDriverAge`, `youngDriverAge` / `youngDriverFeeCentsPerDay`,
  `cancellationWindowHours`, `depositPercent` / `depositMinCents`,
  `openingTime` / `closingTime`. Note that `minDriverAge` and
  `youngDriverAge` are currently both `21`, which makes the young-driver
  surcharge unreachable by design until one of them moves; see
  `docs/superpowers/specs/2026-08-18-tex-desk-vs-reserve-decision.md`
  section 7.
- Confirm desk-mode direction (A/B/C) is either decided or explicitly still
  "A for now," per the same memo, before this goes in front of the owner as
  finished.

---

## Risks / notes

- **This is the first live exercise** of the Supabase storage driver, the
  Cloudflare cron dispatch, and the `0016`/journal remap protections against
  a real populated database. Everything before this runbook was verified
  against local PGlite and a local dev server only (`docs/PORT-LOG.md`'s
  Concerns appendix lists every deferred item by wave).
- **Cost** stays in the range `GO-LIVE-RUNBOOK.md` §12 already quotes
  (roughly $30-35/mo infra); this port adds no new paid service, only the
  bucket (Supabase Storage, included in the existing project) and no change
  to instance sizing.
- **If this runbook is executed before Task 8's memo is decided**, `wrangler.jsonc`'s
  `PAYMENT_MODE`/`NEXT_PUBLIC_PAYMENT_MODE` stay `"reserve"`/`"reserve"`
  exactly as today; nothing in steps 1-8 depends on that decision either way.
