/**
 * Route-level admin guard. DENY BY DEFAULT (OWASP A01): a request is only
 * admitted with a live, fully-authenticated admin session, CSRF-verified on
 * unsafe methods, and an allowed role. MFA-pending sessions (password ok,
 * TOTP outstanding) are admitted ONLY where explicitly allowed (the MFA
 * verification endpoints themselves).
 */
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adminUsers } from "@/lib/db/schema";
import { resolveSession, type SessionRecord } from "@/lib/auth/sessions";
import { enforceCsrf } from "@/lib/auth/csrf";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { Errors } from "@/lib/http/errors";

export type AdminRole = "owner" | "staff";
export type AdminUser = typeof adminUsers.$inferSelect;

export interface AdminContext {
  admin: AdminUser;
  session: SessionRecord;
}

export interface RequireAdminOptions {
  /** Admit a session that still owes the TOTP step (MFA endpoints only). */
  allowMfaPending?: boolean;
  roles?: AdminRole[];
}

export async function requireAdmin(
  req: Request,
  opts: RequireAdminOptions = {},
): Promise<AdminContext> {
  const cookieStore = await cookies();
  const session = await resolveSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session || session.subjectType !== "admin") throw Errors.unauthorized();
  if (session.mfaPending && !opts.allowMfaPending) {
    throw Errors.unauthorized("Multi-factor authentication required");
  }

  // CSRF before acting on any cookie-authenticated, state-changing request.
  await enforceCsrf(req, session);

  const db = await getDb();
  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, session.subjectId));
  if (!admin) throw Errors.unauthorized("Account no longer exists");
  if (admin.lockedUntil && admin.lockedUntil.getTime() > Date.now()) {
    throw Errors.unauthorized("Account is locked");
  }

  const roles = opts.roles ?? ["owner", "staff"];
  if (!roles.includes(admin.role)) throw Errors.forbidden();

  return { admin, session };
}
