import { z } from "zod";
import { withRoute } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { parseJsonBody } from "@/lib/http/validate";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { requestReset } from "@/lib/auth/admin-reset";

export const runtime = "nodejs";

const BodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
}).strict();

/**
 * POST /api/admin/auth/reset/request — forgot password, first step.
 * ALWAYS answers { ok: true }: whether the email exists is never revealed
 * (same anti-enumeration stance as the login route). Rate limited per client
 * AND per submitted email so one address cannot be flooded from many IPs.
 */
export const POST = withRoute(async (req) => {
  // Per-client limit FIRST (mirrors the login route): malformed submissions
  // (bad content-type, non-JSON, invalid email) must still count against the
  // limiter, otherwise garbage requests could flood this endpoint without ever
  // tripping the 429. The per-email limit stays after parsing because it needs
  // the normalized address.
  await enforceRateLimit(req, "auth", "admin-reset-request");
  const body = await parseJsonBody(req, BodySchema);
  await enforceRateLimit(req, "auth", `admin-reset-request:${body.email}`);
  await requestReset(body.email, req);
  return json({ ok: true }, req);
});
