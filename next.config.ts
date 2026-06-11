import type { NextConfig } from "next";

/**
 * Next.js configuration.
 *
 * Security notes:
 * - `poweredByHeader: false` removes the `X-Powered-By` header, which leaks the
 *   framework/version to attackers (information disclosure — OWASP A05:2021).
 * - `reactStrictMode` surfaces unsafe lifecycle usage during development.
 * - We do NOT set security headers here. They are applied centrally in
 *   `src/middleware.ts` so that the policy is defined in exactly one place
 *   (single source of truth) and applies uniformly to every response,
 *   including 404s and errors.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Produce a self-contained server bundle so the Docker image can be minimal
  // (copy .next/standalone only — no full node_modules). See Dockerfile.
  output: "standalone",
  // argon2 ships a native addon; keep it external so Next doesn't try to bundle
  // the .node binary, and ensure its files are traced into the standalone output.
  serverExternalPackages: ["argon2"],
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/argon2/**"],
  },
  // Fail the production build on type errors / lint errors. Do NOT disable these.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
