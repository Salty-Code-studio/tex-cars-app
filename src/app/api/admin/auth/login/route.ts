import { z } from "zod";
import { withRoute } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { parseJsonBody } from "@/lib/http/validate";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { Errors } from "@/lib/http/errors";
import { loginAdmin } from "@/lib/auth/admin-login";
import { createSession } from "@/lib/auth/sessions";
import { applySessionCookies } from "@/lib/auth/session-cookies";

export const runtime = "nodejs";

const BodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(512),
}).strict();

/**
 * POST /api/admin/auth/login — first factor.
 * Per-IP rate limit (auth tier) + per-account lockout inside loginAdmin.
 * Success issues a session: mfaPending=true when TOTP is enrolled (the second
 * factor is owed), otherwise a full session with enrollRequired=true so the
 * shell forces enrollment before anything else (MFA is mandatory, spec §4).
 */
export const POST = withRoute(async (req) => {
  enforceRateLimit(req, "auth", "admin-login");
  const body = await parseJsonBody(req, BodySchema);

  const result = await loginAdmin(body.email, body.password, { req });
  if (!result.ok) {
    if (result.retryAfterSec) throw Errors.rateLimited(result.retryAfterSec, "Account temporarily locked");
    throw Errors.unauthorized("Invalid email or password");
  }

  const created = await createSession({
    subjectType: "admin",
    subjectId: result.adminId,
    mfaPending: result.mfaEnabled, // TOTP owed only when enrolled
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    ua: req.headers.get("user-agent"),
  });

  const res = json(
    result.mfaEnabled ? { mfaRequired: true } : { enrollRequired: true },
    req,
  );
  return applySessionCookies(res, created);
});
