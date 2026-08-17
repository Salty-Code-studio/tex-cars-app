/**
 * Admin forgot-password flow (spec: docs/superpowers/specs/
 * 2026-08-17-admin-password-reset-design.md).
 *
 * One token mechanism, two delivery paths: requestReset emails the link
 * (anti-enumeration: silent on unknown emails), mintResetLink returns it for
 * the owner to hand over out-of-band. confirmReset consumes the token,
 * rehashes the password, revokes every session and clears lockout counters.
 * MFA is deliberately untouched: a reset link alone must not defeat TOTP.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adminResetTokens, adminUsers } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { destroyAllForSubject } from "@/lib/auth/sessions";
import { sendAndLog } from "@/lib/email/send";
import { passwordResetEmail } from "@/lib/email/templates";
import { audit } from "@/lib/audit";
import { Errors } from "@/lib/http/errors";
import { env } from "@/env";

export const RESET_TTL_MINUTES = 30;

/** Precomputed at module load so an unknown-email request still burns real
 *  Argon2id time, mirroring the anti-enumeration pattern in admin-login. */
const dummyHashPromise = hashPassword("dummy-timing-equalizer-not-a-credential");

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

async function issueToken(adminUserId: string): Promise<string> {
  const db = await getDb();
  const raw = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000);
  await db.transaction(async (tx) => {
    // A new link invalidates any prior unused ones for this admin.
    await tx.update(adminResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(adminResetTokens.adminUserId, adminUserId), isNull(adminResetTokens.usedAt)));
    await tx.insert(adminResetTokens).values({
      adminUserId,
      tokenHash: hashToken(raw),
      expiresAt,
    });
  });
  return raw;
}

function resetUrl(raw: string): string {
  return `${env.APP_ORIGIN}/admin/reset-password?token=${raw}`;
}

export async function mintResetLink(adminUserId: string): Promise<string> {
  const db = await getDb();
  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, adminUserId));
  if (!admin) throw Errors.notFound();
  return resetUrl(await issueToken(adminUserId));
}

export async function requestReset(email: string, req?: Request): Promise<void> {
  const db = await getDb();
  const normalized = email.trim().toLowerCase();
  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.email, normalized));
  if (!admin) {
    // Uniform-ish timing on miss, mirroring the login route's dummy verify.
    await verifyPassword(await dummyHashPromise, "dummy-timing-equalizer-not-a-credential");
    return;
  }
  const url = resetUrl(await issueToken(admin.id));
  await sendAndLog({ to: admin.email, type: "admin_password_reset", ...passwordResetEmail(url) });
  await audit({
    actor: admin.id,
    action: "admin.password_reset_requested",
    entity: "admin_user",
    entityId: admin.id,
    req,
  });
}

export async function confirmReset(rawToken: string, newPassword: string): Promise<{ ok: boolean }> {
  const db = await getDb();
  const hash = hashToken(rawToken);
  // Fast-path pre-check for missing/used/expired tokens. The equality filter on
  // the stored sha256 is the real gate here: only a holder of the raw token can
  // produce a matching hash. This read is advisory only; the authoritative
  // single-use decision is the conditional UPDATE inside the transaction below.
  const [row] = await db.select().from(adminResetTokens).where(eq(adminResetTokens.tokenHash, hash));
  if (!row || row.usedAt || row.expiresAt <= new Date()) return { ok: false };

  const passwordHash = await hashPassword(newPassword);
  // Atomic consume: mark the token used ONLY if it is still unused, and bail
  // without touching the admin row otherwise. Under READ COMMITTED two
  // concurrent confirms can both pass the pre-check above, but only one wins
  // this UPDATE; the loser sees zero rows returned and the whole confirm fails.
  const consumed = await db.transaction(async (tx) => {
    const winners = await tx.update(adminResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(adminResetTokens.id, row.id), isNull(adminResetTokens.usedAt)))
      .returning({ id: adminResetTokens.id });
    if (winners.length === 0) return false;
    await tx.update(adminUsers).set({
      passwordHash,
      failedAttempts: 0,
      lockedUntil: null,
      mfaFailedAttempts: 0,
      mfaLockedUntil: null,
    }).where(eq(adminUsers.id, row.adminUserId));
    return true;
  });
  if (!consumed) return { ok: false };

  await destroyAllForSubject("admin", row.adminUserId);
  await audit({
    actor: row.adminUserId,
    action: "admin.password_reset_completed",
    entity: "admin_user",
    entityId: row.adminUserId,
  });
  return { ok: true };
}
