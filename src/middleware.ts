import { NextResponse, type NextRequest } from "next/server";
import { securityHeaders } from "@/lib/http/security-headers";
import { corsHeaders, preflightResponse } from "@/lib/http/cors";

/**
 * Edge middleware — the FIRST line of defense, applied to every matched request.
 *
 * Responsibilities (kept minimal and side-effect free; no secrets read here):
 *   1. Answer CORS preflight (OPTIONS) requests immediately.
 *   2. Stamp secure response headers on EVERY response (single source of truth,
 *      including 404s and error pages that never reach a route handler).
 *   3. Merge CORS headers for allowed origins.
 *
 * NOTE: This runs on the Edge runtime, which lacks Node APIs. We deliberately do
 * NOT do auth/crypto here (those live in route handlers on the Node runtime).
 * Middleware does NOT replace per-route authentication & authorization.
 */
export function middleware(req: NextRequest): NextResponse {
  const origin = req.headers.get("origin");

  // 1. CORS preflight short-circuit.
  if (req.method === "OPTIONS") {
    const pre = preflightResponse(req);
    const res = new NextResponse(pre.body, { status: pre.status, headers: pre.headers });
    for (const [k, v] of Object.entries(securityHeaders())) res.headers.set(k, v);
    return res;
  }

  // 2. Continue, then layer headers onto the outgoing response.
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(securityHeaders())) res.headers.set(k, v);
  for (const [k, v] of Object.entries(corsHeaders(origin))) res.headers.set(k, v);
  return res;
}

export const config = {
  // Apply to all API routes (and you can widen this if you add UI pages).
  matcher: ["/api/:path*"],
};
