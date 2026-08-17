import { describe, it, expect, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { runMigrations } from "@/lib/db/migrate";
import { getDb } from "@/lib/db/client";
import { adminResetTokens } from "@/lib/db/schema";
import { requestReset, mintResetLink, confirmReset } from "@/lib/auth/admin-reset";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, resolveSession } from "@/lib/auth/sessions";

beforeAll(async () => { await runMigrations(); });

function tokenFromUrl(url: string): string {
  return new URL(url).searchParams.get("token")!;
}

async function makeAdmin(email: string) {
  const db = await getDb();
  const { adminUsers } = await import("@/lib/db/schema");
  const [admin] = await db.insert(adminUsers).values({
    email,
    passwordHash: "old-hash",
    failedAttempts: 3,
    mfaEnabled: true,
    totpSecretEnc: Buffer.from("KEEPME"),
  }).returning();
  return admin!;
}

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
      adminUserId: admin!.id,
      tokenHash: "abc",
      expiresAt: new Date(Date.now() + 60_000),
    }).returning();
    expect(row!.usedAt).toBeNull();
    expect(row!.adminUserId).toBe(admin!.id);
  });
});

describe("admin password reset service", () => {
  it("mints a link whose token confirms once and updates the password", async () => {
    const admin = await makeAdmin("svc1@test.com");
    const url = await mintResetLink(admin.id);
    expect(url).toContain("/admin/reset-password?token=");
    const r = await confirmReset(tokenFromUrl(url), "brand-new-password-123");
    expect(r.ok).toBe(true);
    const db = await getDb();
    const { adminUsers } = await import("@/lib/db/schema");
    const [after] = await db.select().from(adminUsers).where(eq(adminUsers.id, admin.id));
    expect(await verifyPassword(after!.passwordHash, "brand-new-password-123")).toBe(true);
    expect(after!.failedAttempts).toBe(0);
    expect(after!.lockedUntil).toBeNull();
    // MFA untouched
    expect(after!.mfaEnabled).toBe(true);
    expect(Buffer.from(after!.totpSecretEnc!).toString()).toBe("KEEPME");
    // single-use
    expect((await confirmReset(tokenFromUrl(url), "another-long-password-1")).ok).toBe(false);
  });

  it("revokes all sessions on reset", async () => {
    const admin = await makeAdmin("svc2@test.com");
    const s = await createSession({ subjectType: "admin", subjectId: admin.id, mfaPending: false });
    const url = await mintResetLink(admin.id);
    await confirmReset(tokenFromUrl(url), "brand-new-password-123");
    expect(await resolveSession(s.cookieValue)).toBeNull();
  });

  it("expired and tampered tokens fail", async () => {
    const admin = await makeAdmin("svc3@test.com");
    const url = await mintResetLink(admin.id);
    const db = await getDb();
    await db.update(adminResetTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(adminResetTokens.adminUserId, admin.id));
    expect((await confirmReset(tokenFromUrl(url), "brand-new-password-123")).ok).toBe(false);
    expect((await confirmReset("not-a-real-token", "brand-new-password-123")).ok).toBe(false);
  });

  it("a new link invalidates the previous one", async () => {
    const admin = await makeAdmin("svc4@test.com");
    const first = await mintResetLink(admin.id);
    await mintResetLink(admin.id);
    expect((await confirmReset(tokenFromUrl(first), "brand-new-password-123")).ok).toBe(false);
  });

  it("requestReset resolves silently for unknown emails", async () => {
    await expect(requestReset("nobody@test.com")).resolves.toBeUndefined();
    const db = await getDb();
    const rows = await db.select().from(adminResetTokens);
    const before = rows.length;
    await requestReset("nobody@test.com");
    expect((await db.select().from(adminResetTokens)).length).toBe(before);
  });

  it("requestReset for a real admin mints a token (email logged as skipped without key)", async () => {
    const admin = await makeAdmin("svc5@test.com");
    await requestReset("SVC5@test.com"); // case-insensitive
    const db = await getDb();
    const rows = await db.select().from(adminResetTokens).where(eq(adminResetTokens.adminUserId, admin.id));
    expect(rows.length).toBe(1);
    expect(rows[0]!.usedAt).toBeNull();
  });
});
