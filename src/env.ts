import { z } from "zod";

/**
 * Environment schema validation — runs at module load (boot) and FAILS CLOSED.
 *
 * Why this exists (defense-in-depth, fail-closed):
 *   A missing/weak secret is a security bug, not a runtime inconvenience. We
 *   validate ALL configuration at the trust boundary between the deployment
 *   platform and the app. If anything is missing, malformed, or too weak, the
 *   process refuses to start. This prevents shipping with a default/empty JWT
 *   secret — a classic instance of OWASP A02:2021 (Cryptographic Failures) and
 *   A05:2021 (Security Misconfiguration).
 *
 * Notes:
 *   - This module MUST NOT be imported into client components. It reads secrets.
 *     Next.js keeps it server-only as long as it's only used in route handlers,
 *     middleware, and server libs. We add a runtime guard below as a backstop.
 *   - We never log secret VALUES. Errors mention variable NAMES only.
 */

if (typeof window !== "undefined") {
  // Backstop against accidental client-bundle inclusion. Fail loudly.
  throw new Error("env.ts was imported in a browser context. This module is server-only.");
}

/** A secret must be long enough to resist brute force. 32 bytes ~ 43 base64 chars. */
const MIN_SECRET_LENGTH = 32;

/** Reject the obvious placeholder values shipped in .env.example. */
const looksLikePlaceholder = (value: string): boolean =>
  /change_me|placeholder|example|your[_-]?secret/i.test(value);

const secret = (name: string) =>
  z
    .string({ required_error: `${name} is required` })
    .min(MIN_SECRET_LENGTH, `${name} must be at least ${MIN_SECRET_LENGTH} characters`)
    .refine((v) => !looksLikePlaceholder(v), {
      message: `${name} still contains a placeholder value — generate a real secret`,
    });

const positiveInt = (name: string) =>
  z.coerce
    .number({ invalid_type_error: `${name} must be a number` })
    .int(`${name} must be an integer`)
    .positive(`${name} must be positive`);

/** Comma-separated origins -> validated string[] of exact origins. */
const originList = z
  .string()
  .transform((s) =>
    s
      .split(",")
      .map((o) => o.trim())
      .filter((o) => o.length > 0),
  )
  .pipe(
    z
      .array(
        z
          .string()
          .url("CORS_ALLOWED_ORIGINS entries must be absolute URLs (scheme + host)")
          .refine((u) => {
            // An "origin" must not carry a path/query/fragment.
            try {
              const parsed = new URL(u);
              return parsed.origin === u.replace(/\/$/, "");
            } catch {
              return false;
            }
          }, "CORS_ALLOWED_ORIGINS entries must be bare origins (no path)"),
      )
      .min(1, "CORS_ALLOWED_ORIGINS must list at least one origin"),
  );

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    APP_ORIGIN: z.string().url("APP_ORIGIN must be an absolute URL"),
    CORS_ALLOWED_ORIGINS: originList,

    SESSION_SECRET: secret("SESSION_SECRET"),
    SESSION_TTL_SECONDS: positiveInt("SESSION_TTL_SECONDS").default(86_400),

    RATE_LIMIT_GLOBAL_MAX: positiveInt("RATE_LIMIT_GLOBAL_MAX").default(100),
    RATE_LIMIT_GLOBAL_WINDOW_SECONDS: positiveInt("RATE_LIMIT_GLOBAL_WINDOW_SECONDS").default(60),
    RATE_LIMIT_AUTH_MAX: positiveInt("RATE_LIMIT_AUTH_MAX").default(5),
    RATE_LIMIT_AUTH_WINDOW_SECONDS: positiveInt("RATE_LIMIT_AUTH_WINDOW_SECONDS").default(60),

    // Whether to trust client-supplied forwarding headers (X-Forwarded-For /
    // X-Real-IP) for the rate-limit client identifier. DEFAULT FALSE
    // (secure-by-default): these headers are trivially spoofable, so honoring
    // them unconditionally lets an attacker rotate the value per request and
    // bypass the brute-force limiter entirely. Set TRUE ONLY when this app sits
    // behind a reverse proxy / platform edge that OVERWRITES these headers.
    TRUST_PROXY: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),

    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  });

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Print variable NAMES + messages, never values. Then fail closed.
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
    const banner = "Invalid environment configuration. The app will not start.\n";
    // eslint-disable-next-line no-console -- boot-time fatal; logger may not be ready.
    console.error(`\n${banner}${lines.join("\n")}\n`);
    throw new Error("Environment validation failed (see errors above).");
  }
  return parsed.data;
}

/** Validated, frozen environment. Import this everywhere instead of process.env. */
export const env: Readonly<Env> = Object.freeze(loadEnv());

export const isProd = env.NODE_ENV === "production";
