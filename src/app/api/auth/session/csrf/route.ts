import { cookies } from "next/headers";
import { withRoute } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { resolveSession } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { Errors } from "@/lib/http/errors";

/**
 * GET /api/auth/session/csrf — return the current session's CSRF token.
 *
 * For SPA clients that prefer fetching the token explicitly rather than reading
 * the (non-HttpOnly) CSRF cookie. Requires an active session. This is a SAFE
 * (GET) method, so no CSRF check is needed to call it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withRoute(async (req) => {
  const cookieStore = await cookies();
  const session = resolveSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) throw Errors.unauthorized();
  return json({ csrfToken: session.csrfToken }, req);
});
