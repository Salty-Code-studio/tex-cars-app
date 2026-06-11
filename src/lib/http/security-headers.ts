import { isProd } from "@/env";

/**
 * Centralized secure response headers (the "helmet-equivalent" for Next.js).
 *
 * Applied to EVERY response from middleware so coverage is uniform. References:
 *   - OWASP Secure Headers Project
 *   - MDN security header docs
 *
 * Header-by-header rationale:
 *   Content-Security-Policy ....... Mitigates XSS/data-injection (A03). This is a
 *       strict API-oriented policy: default-src 'none' means nothing loads unless
 *       explicitly allowed. For a pure JSON API this is ideal. If you later serve
 *       HTML/UI from this app, relax `script-src`/`style-src` with a NONCE — never
 *       with 'unsafe-inline'.
 *   Strict-Transport-Security ..... Forces HTTPS for 2 years incl. subdomains
 *       (prod only; avoids breaking http://localhost). Defends against SSL strip.
 *   X-Content-Type-Options ........ 'nosniff' stops MIME-type confusion attacks.
 *   X-Frame-Options + CSP frame-ancestors 'none' .. Clickjacking defense.
 *   Referrer-Policy ............... Don't leak full URLs cross-origin.
 *   Permissions-Policy ............ Disable powerful browser features by default.
 *   Cross-Origin-* ................ Isolate the document (Spectre-class defense).
 *   Cache-Control (for API) ....... Prevent caching of potentially sensitive JSON.
 */

const CSP_DIRECTIVES = [
  "default-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  // No inline scripts/styles for the API. If you add a UI, use a per-request nonce.
  "script-src 'self'",
  "style-src 'self'",
  "object-src 'none'",
].join("; ");

export function securityHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": CSP_DIRECTIVES,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Permitted-Cross-Domain-Policies": "none",
    // Sensitive-by-default: tell shared caches not to store API responses.
    "Cache-Control": "no-store",
  };

  if (isProd) {
    // 2 years, include subdomains, eligible for preload list.
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  }

  return headers;
}
