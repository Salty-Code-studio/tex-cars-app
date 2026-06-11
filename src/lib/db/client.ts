/**
 * Database client factory — one `getDb()` for the whole app.
 *
 * Two drivers behind one interface (selected by DATABASE_URL scheme):
 *   - pglite://   real Postgres compiled to WASM, in-process. Zero install,
 *                 used for local dev and tests. Loads btree_gist so the
 *                 bookings exclusion constraint behaves exactly like prod.
 *   - postgres:// postgres-js against Neon (or any Postgres) in production.
 *                 `prepare: false` because Neon's pooled URLs sit behind
 *                 pgbouncer (transaction mode), which breaks named prepares.
 *
 * SECURITY: all access goes through Drizzle's typed builder — parameterized
 * queries only (OWASP A03:2021). Never interpolate user input into raw SQL.
 */
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { env } from "@/env";
import * as schema from "./schema";

/** The common Postgres interface both drivers satisfy. Using one concrete type
 *  (instead of a union) keeps builder methods like `.returning()` callable. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

async function createDb(): Promise<Db> {
  if (env.DATABASE_URL.startsWith("pglite://")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { btree_gist } = await import("@electric-sql/pglite/contrib/btree_gist");
    const { drizzle } = await import("drizzle-orm/pglite");
    const target = env.DATABASE_URL.slice("pglite://".length);
    // NOTE: must use the options-object form — new PGlite(undefined, opts)
    // silently ignores opts, and the btree_gist extension never registers.
    const client = new PGlite({
      ...(target === "memory" ? {} : { dataDir: target }),
      extensions: { btree_gist },
    });
    return drizzle(client, { schema }) as unknown as Db;
  }
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const postgres = (await import("postgres")).default;
  const client = postgres(env.DATABASE_URL, { max: 10, prepare: false });
  return drizzle(client, { schema }) as unknown as Db;
}

let dbPromise: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  dbPromise ??= createDb();
  return dbPromise;
}
