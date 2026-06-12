import { env } from "@/env";
import { Errors } from "@/lib/http/errors";

/**
 * In-memory fixed-window rate limiter.
 *
 * Security rationale (OWASP A07:2021 — Identification & Authentication Failures):
 *   Auth endpoints are the prime target for brute-force / credential stuffing.
 *   We apply a STRICT per-identifier budget there and a looser global budget
 *   elsewhere. Fail-closed: if the limit is exceeded we deny with 429.
 *
 * IMPORTANT — production note:
 *   This implementation is per-process and resets on restart. It is correct and
 *   useful for a single instance / local dev, but it does NOT coordinate across
 *   horizontally-scaled instances. For production behind multiple replicas,
 *   replace `hit()` with a shared store (e.g. Redis INCR + EXPIRE, or Upstash
 *   Ratelimit). The call sites do not need to change — only this module.
 */

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

// Opportunistic cleanup so the Map doesn't grow unbounded.
let lastSweep = 0;
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
  resetAt: number; // epoch ms
  retryAfterSeconds: number;
}

function hit(key: string, max: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const windowMs = windowSeconds * 1000;
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    const bucket: Bucket = { count: 1, resetAt: now + windowMs };
    store.set(key, bucket);
    return { ok: true, remaining: max - 1, limit: max, resetAt: bucket.resetAt, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const remaining = Math.max(0, max - existing.count);
  const ok = existing.count <= max;
  return {
    ok,
    remaining,
    limit: max,
    resetAt: existing.resetAt,
    retryAfterSeconds: ok ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  };
}

/**
 * Derive a client identifier for rate limiting.
 *
 * SECURITY: `x-forwarded-for` / `x-real-ip` are CLIENT-SUPPLIED and trivially
 * spoofable. If we honored them unconditionally, an attacker could rotate the
 * header value on every request and get a fresh bucket each time — fully
 * bypassing the auth brute-force limiter (this starter's headline A07 control).
 *
 * Therefore we trust these headers ONLY when `TRUST_PROXY=true`, which the
 * operator sets EXCLUSIVELY when the app sits behind a reverse proxy / platform
 * edge that OVERWRITES (not appends) the header. We then read the FIRST hop.
 *
 * When `TRUST_PROXY=false` (the secure default) we IGNORE the forwarding
 * headers and fall back to a single shared "unknown" bucket. That is
 * fail-closed: every direct client shares one strict budget rather than each
 * minting its own by forging a header. Operators running without a trusted
 * proxy should put a real proxy in front (then enable TRUST_PROXY) for
 * per-client fairness.
 */
export function clientIdentifier(req: Request): string {
  if (env.TRUST_PROXY) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    }
    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
  }
  return "unknown";
}

export type LimitTier = "global" | "auth";

const REDIS_CONFIGURED = !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);

/**
 * Fixed-window counter in Upstash Redis (REST API, no SDK). Atomic-enough:
 * INCR returns the new count, and we set the TTL on the first hit. Coordinates
 * the limit across all serverless instances. On any Redis error we FAIL OPEN to
 * the in-memory limiter rather than locking everyone out.
 */
async function hitRedis(key: string, max: number, windowSeconds: number): Promise<RateLimitResult> {
  const base = env.UPSTASH_REDIS_REST_URL;
  const auth = { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` };
  try {
    const incr = await fetch(`${base}/incr/${encodeURIComponent(key)}`, { headers: auth, cache: "no-store" });
    const { result: count } = (await incr.json()) as { result: number };
    if (count === 1) {
      await fetch(`${base}/expire/${encodeURIComponent(key)}/${windowSeconds}`, { headers: auth, cache: "no-store" });
    }
    const ttlRes = await fetch(`${base}/ttl/${encodeURIComponent(key)}`, { headers: auth, cache: "no-store" });
    const { result: ttl } = (await ttlRes.json()) as { result: number };
    const resetAt = Date.now() + Math.max(0, ttl) * 1000;
    const ok = count <= max;
    return { ok, remaining: Math.max(0, max - count), limit: max, resetAt, retryAfterSeconds: ok ? 0 : Math.max(1, ttl) };
  } catch {
    return hit(key, max, windowSeconds); // fail open to the local limiter
  }
}

/** Enforce a tier's limit. Throws a 429 AppError when exceeded. Uses Upstash
 *  Redis across instances when configured, else the in-memory limiter. */
export async function enforceRateLimit(req: Request, tier: LimitTier, scope = ""): Promise<RateLimitResult> {
  const id = clientIdentifier(req);
  const [max, windowSeconds] =
    tier === "auth"
      ? [env.RATE_LIMIT_AUTH_MAX, env.RATE_LIMIT_AUTH_WINDOW_SECONDS]
      : [env.RATE_LIMIT_GLOBAL_MAX, env.RATE_LIMIT_GLOBAL_WINDOW_SECONDS];

  const key = `rl:${tier}:${scope}:${id}`;
  const result = REDIS_CONFIGURED ? await hitRedis(key, max, windowSeconds) : hit(key, max, windowSeconds);
  if (!result.ok) {
    throw Errors.rateLimited(result.retryAfterSeconds);
  }
  return result;
}

/** Standard rate-limit headers to expose remaining budget to good clients. */
export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(Math.ceil(r.resetAt / 1000)),
  };
}
