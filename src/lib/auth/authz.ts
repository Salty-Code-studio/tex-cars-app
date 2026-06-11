import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth/session";
import { enforceCsrf } from "@/lib/auth/csrf";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { memoryStore as db, type SessionRecord, type UserRecord } from "@/lib/auth/memory-store";
import { Errors } from "@/lib/http/errors";

/**
 * Authentication + authorization helpers.
 *
 * One way to authenticate (per the Phase 2 spec there is no JWT surface):
 *   - "session": signed session cookie (+ CSRF on unsafe methods)
 *
 * DENY BY DEFAULT: `requireUser` throws 401 unless a valid credential is found.
 * Authorization (ownership) is a SEPARATE, explicit step — see `assertOwnership`.
 * This separates authn (who you are) from authz (what you may touch), per OWASP
 * A01:2021 (Broken Access Control).
 */

export type AuthMethod = "session";

export interface AuthContext {
  user: UserRecord;
  method: AuthMethod;
  session?: SessionRecord;
}

/**
 * Resolve the authenticated user or throw 401. For the session path on unsafe
 * methods we ENFORCE CSRF before trusting the request.
 */
export async function requireUser(req: Request): Promise<AuthContext> {
  const cookieStore = await cookies();
  const sidValue = cookieStore.get(SESSION_COOKIE)?.value;
  const session = resolveSession(sidValue);
  if (session) {
    // CSRF check BEFORE acting on a cookie-authenticated, state-changing request.
    await enforceCsrf(req, session);
    const user = db.users.findById(session.userId);
    if (!user) throw Errors.unauthorized("Account no longer exists");
    return { user, method: "session", session };
  }

  throw Errors.unauthorized();
}

/**
 * Ownership/authorization check. Throw 404 (not 403) when the requester does not
 * own the resource, so we don't reveal that the id EXISTS to a non-owner
 * (avoids resource enumeration / IDOR information leakage). Use `forbidden`
 * instead only when the existence of the resource is already known to the user.
 */
export function assertOwnership(ownerId: string, ctx: AuthContext): void {
  if (ownerId !== ctx.user.id) {
    throw Errors.notFound();
  }
}
