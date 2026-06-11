import { z } from "zod";
import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { withRoute } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { parseJsonBody } from "@/lib/http/validate";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { Errors } from "@/lib/http/errors";
import { getDb } from "@/lib/db/client";
import { adminUsers, adminRecoveryCodes } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { rotateSession } from "@/lib/auth/sessions";
import { applySessionCookies } from "@/lib/auth/session-cookies";
import { decryptField } from "@/lib/crypto/fields";
import { verifyTotp } from "@/lib/auth/totp";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

const BodySchema = z.object({
  code: z.string().trim().max(16).optional(),
  recoveryCode: z.string().trim().max(64).optional(),
}).strict().refine((b) => !!b.code !== !!b.recoveryCode, {
  message: "Provide exactly one of code or recoveryCode",
});

/**
 * POST /api/admin/auth/mfa/verify — second factor at login.
 * Requires the mfa-pending session from the password step. A 6-digit space is
 * tiny, so attempts ride the strict auth rate limit on top of the TOTP replay
 * defense. Success ROTATES the session to full (fixation defense).
 */
export const POST = withRoute(async (req) => {
  enforceRateLimit(req, "auth", "admin-mfa-verify");
  const { admin, session } = await requireAdmin(req, { allowMfaPending: true });
  if (!session.mfaPending) throw Errors.badRequest("Session is already fully authenticated");
  if (!admin.mfaEnabled || !admin.totpSecretEnc) throw Errors.badRequest("MFA is not enrolled");

  const body = await parseJsonBody(req, BodySchema);
  const db = await getDb();

  if (body.code) {
    const secretB64 = decryptField(admin.totpSecretEnc, `admin_users:${admin.id}:totp_secret`);
    const result = verifyTotp(Buffer.from(secretB64, "base64"), body.code, admin.totpLastUsedStep);
    if (!result.ok) {
      await audit({ actor: admin.id, action: "admin.mfa_failed", entity: "admin_user", entityId: admin.id, req });
      throw Errors.unauthorized("Invalid code");
    }
    await db.update(adminUsers)
      .set({ totpLastUsedStep: result.usedStep!, updatedAt: new Date() })
      .where(eq(adminUsers.id, admin.id));
    await audit({ actor: admin.id, action: "admin.mfa_verified", entity: "admin_user", entityId: admin.id, req });
  } else {
    const hash = createHash("sha256").update(body.recoveryCode!).digest("hex");
    // Atomic single-use consume: only this UPDATE can flip used_at from NULL.
    const consumed = await db.update(adminRecoveryCodes)
      .set({ usedAt: new Date() })
      .where(and(
        eq(adminRecoveryCodes.adminUserId, admin.id),
        eq(adminRecoveryCodes.codeHash, hash),
        isNull(adminRecoveryCodes.usedAt),
      ))
      .returning({ id: adminRecoveryCodes.id });
    if (consumed.length === 0) {
      await audit({ actor: admin.id, action: "admin.recovery_code_failed", entity: "admin_user", entityId: admin.id, req });
      throw Errors.unauthorized("Invalid recovery code");
    }
    await audit({ actor: admin.id, action: "admin.recovery_code_used", entity: "admin_user", entityId: admin.id, req });
  }

  const rotated = await rotateSession(session, { mfaPending: false });
  return applySessionCookies(json({ ok: true }, req), rotated);
});
