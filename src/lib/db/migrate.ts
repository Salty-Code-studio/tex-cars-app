/**
 * Migration runner — applies the SQL files in ./drizzle to whichever driver
 * DATABASE_URL selects. Used by tests (into PGlite) and by `npm run db:migrate`.
 */
import path from "node:path";
import { env } from "@/env";
import { getDb } from "./client";

const migrationsFolder = path.resolve(process.cwd(), "drizzle");

export async function runMigrations(): Promise<void> {
  const db = await getDb();
  if (env.DATABASE_URL.startsWith("pglite://")) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db as never, { migrationsFolder });
  }
}
