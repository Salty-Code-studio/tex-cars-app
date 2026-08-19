import { withRoute } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { Errors } from "@/lib/http/errors";
import { env } from "@/env";
import { getDb } from "@/lib/db/client";
import { createSession } from "@/lib/auth/sessions";
import { applySessionCookies } from "@/lib/auth/session-cookies";
import { trustedClientIp } from "@/lib/http/client-ip";
import { provisionDemoAdmin } from "@/lib/auth/demo";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST /api/admin/auth/demo — one-click demo entry for the local product demo.
 *
 * Gated ENTIRELY behind DEMO_MODE: when it is off, the route 404s as if it does
 * not exist, so a real deployment never exposes a password/MFA-free admin door.
 * When on, it SELF-PROVISIONS (idempotently) the seeded demo admin
 * (mfaEnabled=true, role owner) and mints a FULL (non-mfaPending) session for it,
 * so a viewer can explore the ops dashboard with sample data on the very first
 * hit, with no separate out-of-band seed step required. The real login + MFA
 * path (/api/admin/auth/login and /mfa/verify) is deliberately left untouched.
 *
 * Task 7 gate fix (2026-08): previously called findDemoAdmin, which only looked
 * the row up. Nothing in scripts/ or src/ ever called provisionDemoAdmin, so on
 * any fresh environment (fresh clone, fresh prod deploy with DEMO_MODE=true) this
 * route 404'd forever — the demo door was unreachable. Covering test:
 * src/test/admin-demo-login.test.ts.
 */
export const POST = withRoute(async (req) => {
  if (!env.DEMO_MODE) throw Errors.notFound();
  await enforceRateLimit(req, "auth", "admin-demo-login");

  const db = await getDb();
  const admin = await provisionDemoAdmin(db);

  const created = await createSession({
    subjectType: "admin",
    subjectId: admin.id,
    mfaPending: false,
    ip: trustedClientIp(req),
    ua: req.headers.get("user-agent"),
  });

  await audit({ actor: admin.id, action: "admin.demo_login", entity: "admin_user", entityId: admin.id, req });
  return applySessionCookies(json({ ok: true }, req), created);
});
