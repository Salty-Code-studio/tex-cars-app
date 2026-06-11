/**
 * THE data layer entry point: `@/lib/db` means the Drizzle Postgres client.
 * (The fort starter's in-memory reference store moved to
 * src/lib/auth/memory-store.ts and dies in Plan 02.)
 */
export { getDb, closeDb, type Db } from "./client";
export { runMigrations } from "./migrate";
export * as schema from "./schema";
