// =============================================================================
// Cloudflare Worker entrypoint — host-only glue for Tex Cars Phase 2.
//
// This Worker fronts the existing Next.js booking app, which runs UNCHANGED as
// a Cloudflare Container (the app's Dockerfile). Two responsibilities only:
//
//   1. fetch()     — proxy every inbound request to the container's port 3000.
//   2. scheduled() — the hold-expiry + compliance-alerts crons, moved off
//                    Vercel Cron onto native Cloudflare Cron Triggers (see
//                    wrangler.jsonc [triggers]), dispatched by controller.cron.
//
// Design: docs/superpowers/specs/2026-08-03-tex-cars-cloudflare-golive-design.md
// The Next.js app, its env contract (src/env.ts), schema, and business logic are
// NOT touched. All configuration is forwarded from the Worker's bindings into
// the container's process env at start, so the app reads the exact same
// variables it would on any other host.
// =============================================================================

import { Container, getContainer } from "@cloudflare/containers";

/**
 * Configuration forwarded verbatim into the container's process env. Every name
 * must match app/src/env.ts EXACTLY. Non-secret values arrive from
 * wrangler.jsonc `vars`; secrets arrive from `wrangler secret put`. Both land on
 * the Worker `env` object, so a single allow-list covers them.
 *
 * Only keys that are present and non-empty are forwarded, so optional app
 * settings keep their in-app defaults when unset.
 */
const CONTAINER_ENV_KEYS = [
  "NODE_ENV",
  "APP_ORIGIN",
  "CORS_ALLOWED_ORIGINS",
  "TRUST_PROXY",
  "SESSION_SECRET",
  "SESSION_TTL_SECONDS",
  "SESSION_IDLE_TTL_SECONDS",
  "DATABASE_URL",
  "DATA_ENCRYPTION_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "CRON_SECRET",
  "LOG_LEVEL",
  "PAYMENT_MODE",
  "NEXT_PUBLIC_PAYMENT_MODE",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
] as const;

interface Env {
  CONTAINER: DurableObjectNamespace<TexCarsContainer>;
  CRON_SECRET?: string;
  // vars + secrets are string-valued bindings surfaced on env.
  [key: string]: unknown;
}

/** Build the container's env from the Worker bindings (present, non-empty only). */
function containerEnvVars(env: Env): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key of CONTAINER_ENV_KEYS) {
    const value = env[key];
    if (typeof value === "string" && value.length > 0) {
      vars[key] = value;
    }
  }
  return vars;
}

export class TexCarsContainer extends Container<Env> {
  // The Next.js standalone server listens on 3000 (Dockerfile PORT/HOSTNAME).
  defaultPort = 3000;

  // Keep the single instance warm between the 15-minute cron ticks so the
  // public /book flow never pays a cold start. Each cron run resets this idle
  // timer, so in practice the container stays live. (Design §3, §9.)
  sleepAfter = "45m";

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env, {
      defaultPort: 3000,
      sleepAfter: "45m",
      // The app must reach Supabase (Postgres/TCP), Upstash, Stripe and Resend.
      enableInternet: true,
      envVars: containerEnvVars(env),
    });
  }
}

// Required named export so Cloudflare can construct the container proxy DO.
// Omitting it yields "ctx.exports.ContainerProxy is undefined" at runtime.
export { ContainerProxy } from "@cloudflare/containers";

// A single pinned instance = one warm container serving all traffic.
const INSTANCE_ID = "tex-cars-app";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const container = getContainer(env.CONTAINER, INSTANCE_ID);
    return container.fetch(request);
  },

  /**
   * Cloudflare Cron Trigger dispatch. Replaces the Vercel crons in vercel.json.
   * Keyed on controller.cron so one Worker handles both scheduled jobs: calls
   * the matching authenticated route inside the container, passing the shared
   * CRON_SECRET the route requires.
   */
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const jobs: Record<string, string> = {
      "*/15 * * * *": "/api/cron/expire-holds",
      "0 9 * * *": "/api/cron/compliance-alerts",
    };
    const path = jobs[controller.cron];
    if (!path) return;
    const run = async (): Promise<void> => {
      const container = getContainer(env.CONTAINER, INSTANCE_ID);
      const secret = typeof env.CRON_SECRET === "string" ? env.CRON_SECRET : "";
      const res = await container.containerFetch(
        new Request(`http://container${path}`, {
          headers: { authorization: `Bearer ${secret}` },
        }),
        3000,
      );
      if (!res.ok) {
        console.error(`cron ${path} failed: HTTP ${res.status}`);
      }
    };
    ctx.waitUntil(run());
  },
};
