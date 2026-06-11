import { cookies } from "next/headers";
import { withRoute } from "@/lib/http/handler";
import { noContent } from "@/lib/http/respond";
import { resolveSession, destroySession } from "@/lib/auth/session";
import { enforceCsrf } from "@/lib/auth/csrf";
import {
  SESSION_COOKIE,
  CSRF_COOKIE,
  sessionCookieAttributes,
  csrfCookieAttributes,
  clearedAttributes,
} from "@/lib/auth/cookies";
import { Errors } from "@/lib/http/errors";

/**
 * POST /api/auth/session/logout — destroy the server-side session + clear cookies.
 *
 * Logout is a state-changing, cookie-authenticated action, so it REQUIRES a valid
 * CSRF token (an attacker shouldn't be able to force-log-you-out via CSRF either).
 * Because the session is server-side, deleting it instantly revokes access
 * (unlike a stateless JWT).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withRoute(async (req) => {
  const cookieStore = await cookies();
  const sidValue = cookieStore.get(SESSION_COOKIE)?.value;
  const session = resolveSession(sidValue);

  if (!session) throw Errors.unauthorized();
  await enforceCsrf(req, session);

  destroySession(sidValue);
  cookieStore.set(SESSION_COOKIE, "", clearedAttributes(sessionCookieAttributes(0)));
  cookieStore.set(CSRF_COOKIE, "", clearedAttributes(csrfCookieAttributes(0)));

  return noContent(req);
});
