/**
 * Test environment bootstrap. src/env.ts validates at import time and FAILS
 * CLOSED, so every required variable must exist BEFORE any module under test
 * is imported. Values below are test-only and never used outside vitest.
 */
// NODE_ENV is set to "test" by vitest itself (and is typed read-only).
process.env.APP_ORIGIN ??= "http://localhost:3000";
process.env.CORS_ALLOWED_ORIGINS ??= "http://localhost:3000";
// HARD-assign the dangerous three: tests must never inherit a real connection
// string or real secrets from the shell/CI environment. With ??= an ambient
// Neon DATABASE_URL would make the suite run migrations and insert junk into
// a real database.
process.env.SESSION_SECRET = "t".repeat(24) + "s".repeat(24);
process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.DATABASE_URL = "pglite://memory";
process.env.STRIPE_SECRET_KEY = "sk_test_0000000000000000000000000000";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_testtesttesttesttesttesttest00";
// Fourth hard-assign (Task 7 gate fix, 2026-08): the storage-touching test
// files (storage-local, inspection-complete, inspection-retention,
// upload-body-cap) each `rm -rf` their own storage dir in afterAll. `npm test`
// does NOT load .env.local (unlike dev/build/migrate/seed), so without this
// override LOCAL_STORAGE_DIR falls back to the SAME ".dev-storage" default a
// real `npm run dev` session writes real check-in photos/signatures/contract
// PDFs to. Running the suite while (or after) a dev/demo server has real local
// storage content silently wiped it, discovered live during Task 7's dynamic
// smoke. A dedicated test-only dir makes that collision structurally
// impossible instead of relying on nobody ever running both in one workspace.
process.env.LOCAL_STORAGE_DIR = ".test-storage";
