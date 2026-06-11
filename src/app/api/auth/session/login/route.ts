import { cookies } from "next/headers";
import { withRoute } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { parseJsonBody } from "@/lib/http/validate";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { loginSchema } from "@/lib/schemas";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { createSession, SESSION_TTL_SECONDS } from "@/lib/auth/session";
import {
  SESSION_COOKIE,
  CSRF_COOKIE,
  sessionCookieAttributes,
  csrfCookieAttributes,
} from "@/lib/auth/cookies";
import { db } from "@/lib/db";
import { Errors } from "@/lib/http/errors";
import { logger } from "@/lib/logger";

/**
 * POST /api/auth/session/login — cookie-based login.
 *
 * Sets two cookies:
 *   - SESSION_COOKIE: signed, HttpOnly, SameSite=Lax, (Secure + __Host- in prod).
 *   - CSRF_COOKIE: readable (not HttpOnly) per-session token for double-submit.
 *
 * Same anti-enumeration / generic-error posture as the JWT login.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let dummyHashPromise: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword("invalid-placeholder-password-do-not-use");
  return dummyHashPromise;
}

export const POST = withRoute(async (req, { requestId }) => {
  enforceRateLimit(req, "auth", "session-login");

  const { email, password } = await parseJsonBody(req, loginSchema);

  const user = db.users.findByEmail(email);
  const hashToCheck = user?.passwordHash ?? (await dummyHash());
  const ok = await verifyPassword(hashToCheck, password);

  if (!user || !ok) {
    logger.warn("session_login_failed", { requestId, email });
    throw Errors.unauthorized("Invalid email or password");
  }

  const { cookieValue, csrfToken } = createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, cookieValue, sessionCookieAttributes(SESSION_TTL_SECONDS));
  cookieStore.set(CSRF_COOKIE, csrfToken, csrfCookieAttributes(SESSION_TTL_SECONDS));

  logger.info("session_login_success", { requestId, userId: user.id });
  // Also return the CSRF token so SPA clients can read it without parsing cookies.
  return json({ user: { id: user.id, email: user.email }, csrfToken }, req);
});
