/**
 * Test environment bootstrap. src/env.ts validates at import time and FAILS
 * CLOSED, so every required variable must exist BEFORE any module under test
 * is imported. Values below are test-only and never used outside vitest.
 */
// NODE_ENV is set to "test" by vitest itself (and is typed read-only).
process.env.APP_ORIGIN ??= "http://localhost:3000";
process.env.CORS_ALLOWED_ORIGINS ??= "http://localhost:3000";
process.env.SESSION_SECRET ??= "t".repeat(24) + "s".repeat(24);
process.env.DATA_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
process.env.DATABASE_URL ??= "pglite://memory";
