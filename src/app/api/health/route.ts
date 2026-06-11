import { withRoute } from "@/lib/http/handler";
import { json, noContent } from "@/lib/http/respond";

/**
 * GET /api/health — liveness/readiness probe.
 *
 * Returns the MINIMUM needed by an orchestrator (Kubernetes/Docker) to decide
 * if the instance is healthy. Deliberately leaks NO build/version/dependency
 * detail (information-disclosure avoidance). If you add dependency checks
 * (DB ping, etc.), keep the response body generic and put detail in logs.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // never cache health

export const GET = withRoute(async (req) => {
  return json({ status: "ok", uptimeSeconds: Math.floor(process.uptime()) }, req);
});

// Explicitly answer preflight at the route level too (middleware also handles it).
export const OPTIONS = withRoute(async (req) => noContent(req));
