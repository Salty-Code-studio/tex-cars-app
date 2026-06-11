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
import { env } from "@/env";
import * as schema from "./schema";

async function createDb() {
  if (env.DATABASE_URL.startsWith("pglite://")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { btree_gist } = await import("@electric-sql/pglite/contrib/btree_gist");
    const { drizzle } = await import("drizzle-orm/pglite");
    const target = env.DATABASE_URL.slice("pglite://".length);
    const client = new PGlite(target === "memory" ? undefined : target, {
      extensions: { btree_gist },
    });
    return drizzle(client, { schema });
  }
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const postgres = (await import("postgres")).default;
  const client = postgres(env.DATABASE_URL, { max: 10, prepare: false });
  return drizzle(client, { schema });
}

export type Db = Awaited<ReturnType<typeof createDb>>;

let dbPromise: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  dbPromise ??= createDb();
  return dbPromise;
}
