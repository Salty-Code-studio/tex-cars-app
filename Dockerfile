# syntax=docker/dockerfile:1

# =============================================================================
# Hardened, minimal, multi-stage Docker build.
#
# Security properties:
#   - Multi-stage: build tools never ship in the final image (smaller surface).
#   - Final stage runs as a NON-ROOT user (least privilege; container breakout
#     from an unprivileged user is harder).
#   - Slim base image; only the standalone server + its traced deps are copied.
#   - No secrets baked in: configuration is injected at runtime via env vars.
#   - Healthcheck wired to /api/health for orchestrator readiness.
#   - Pinned base image (digest pinning recommended in your own registry).
# =============================================================================

# Node 22 to match package.json engines (>=22.9.0) and the local/runtime Node.
ARG NODE_VERSION=22.12.0

# ---- deps: install production-capable node_modules (cached layer) ----
# --platform=linux/amd64 on EVERY stage: Cloudflare Containers only runs amd64
# images, and this repo is built on Apple Silicon (arm64). Pinning the platform
# makes `docker build` / `wrangler deploy` emit an amd64 image AND compile
# argon2's native addon for amd64, regardless of the build host's architecture.
FROM --platform=linux/amd64 node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
# argon2 native build needs python3 + build toolchain in THIS stage only.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
# Use a reproducible install. (Generate a lockfile locally before building.)
RUN npm ci

# ---- builder: compile the Next.js standalone output ----
FROM --platform=linux/amd64 node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `prebuild` (scripts/check-env.ts) imports src/env.ts, which validates the FULL
# env schema and fails closed. At build time real secrets are absent, so provide
# build-only placeholders that satisfy every REQUIRED field in src/env.ts. These
# are NOT used at runtime — the real values are injected as Cloudflare container
# secrets when the container RUNS (see wrangler.jsonc + LAUNCH runbook). Keep
# this list in sync with the required fields in app/src/env.ts.
# DOCKER_BUILD=1 tells next.config.ts to skip the in-build type-check/ESLint
# worker (memory-heavy, OOMs a small Docker VM; already gated by npm run
# typecheck/lint/test outside Docker). NODE_OPTIONS bounds the compile heap.
#
# NEXT_PUBLIC_PAYMENT_MODE is a `NEXT_PUBLIC_*` var, so Next.js INLINES it into
# the client JS bundle at build time (it is not read from process.env at
# runtime like the server-only vars above). It MUST be set here, and MUST
# match the runtime PAYMENT_MODE the container is deployed with (see
# wrangler.jsonc `vars` / src/env.ts's PAYMENT_MODE<->NEXT_PUBLIC_PAYMENT_MODE
# cross-check) — otherwise the shipped client bundle shows stale
# Stripe-checkout copy even though the server is running in reserve mode.
ENV DOCKER_BUILD=1 \
    NODE_OPTIONS=--max-old-space-size=3072 \
    NODE_ENV=production \
    APP_ORIGIN=https://build.invalid \
    CORS_ALLOWED_ORIGINS=https://build.invalid \
    SESSION_SECRET=buildonly_session_key_min_thirtytwo_chars_aaaaaaaa \
    DATABASE_URL=pglite://memory \
    DATA_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= \
    STRIPE_SECRET_KEY=sk_test_buildonly00000000000000000000 \
    STRIPE_WEBHOOK_SECRET=whsec_buildonly00000000000000000000 \
    PAYMENT_MODE=reserve \
    NEXT_PUBLIC_PAYMENT_MODE=reserve
RUN npm run build

# ---- runner: minimal, non-root runtime ----
FROM --platform=linux/amd64 node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Create an unprivileged user/group.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

# Copy ONLY what the standalone server needs.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# Liveness/readiness check using Node's built-in fetch (no extra packages).
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+ (process.env.PORT||3000) +'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `server.js` is the entrypoint Next emits for standalone output. It boots the
# Node server (Node forwards SIGTERM to it; our instrumentation handles graceful
# shutdown). Run it directly as PID 1's child via exec form for proper signals.
CMD ["node", "server.js"]
