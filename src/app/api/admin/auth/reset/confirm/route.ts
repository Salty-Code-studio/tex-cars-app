import { z } from "zod";
import { withRoute } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { parseJsonBody } from "@/lib/http/validate";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { Errors } from "@/lib/http/errors";
import { confirmReset } from "@/lib/auth/admin-reset";
import { passwordSchema } from "@/lib/schemas";

export const runtime = "nodejs";

const BodySchema = z.object({
  token: z.string().min(1).max(256),
  password: passwordSchema,
}).strict();

/**
 * POST /api/admin/auth/reset/confirm — sets the new password. Token errors
 * are one generic 400 (no expired vs unknown distinction: that would leak
 * token state to a brute-forcer). Weak passwords 422 in parseJsonBody BEFORE
 * the token is consumed, so a typo does not burn the link.
 */
export const POST = withRoute(async (req) => {
  await enforceRateLimit(req, "auth", "admin-reset-confirm");
  const body = await parseJsonBody(req, BodySchema);
  const result = await confirmReset(body.token, body.password);
  if (!result.ok) throw Errors.badRequest("This reset link is invalid or has expired");
  return json({ ok: true }, req);
});
