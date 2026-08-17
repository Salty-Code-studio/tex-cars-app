import { describe, it, expect, beforeAll } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { getDb } from "@/lib/db/client";
import { adminResetTokens } from "@/lib/db/schema";

beforeAll(async () => { await runMigrations(); });

describe("admin_reset_tokens schema", () => {
  it("inserts and reads a token row", async () => {
    const db = await getDb();
    // need a real admin row for the FK
    const { adminUsers } = await import("@/lib/db/schema");
    const [admin] = await db.insert(adminUsers).values({
      email: "reset-schema@test.com",
      passwordHash: "x",
    }).returning();
    const [row] = await db.insert(adminResetTokens).values({
      adminUserId: admin.id,
      tokenHash: "abc",
      expiresAt: new Date(Date.now() + 60_000),
    }).returning();
    expect(row.usedAt).toBeNull();
    expect(row.adminUserId).toBe(admin.id);
  });
});
