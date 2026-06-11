# Hardened Next.js Route Handlers API Starter

A production-grade, **secure-by-default** API starter built on the Next.js App
Router (Route Handlers, TypeScript). It demonstrates defense-in-depth across the
whole request lifecycle: config validation at boot, secure headers + CSP, strict
CORS, rate limiting, request validation, centralized non-leaking error handling,
structured secret-safe logging, Argon2id password hashing, **both** JWT
(access + refresh) and session-cookie auth, CSRF for the cookie path, an
owner-scoped protected resource, a `/health` probe, and graceful shutdown.

> **No system is "unhackable."** This starter is *hardened* and follows current
> best practice. Security is a process: keep dependencies patched, run reviews,
> add monitoring, and complete the "What you still must do" checklist below.

---

## Security philosophy

- **Defense-in-depth** — multiple independent layers (middleware headers + CORS,
  per-route auth, per-query ownership scoping, CSRF + SameSite).
- **Secure-by-default** — the safe path is the default path; insecure options
  require deliberate change.
- **Least privilege** — cookies are scoped/HttpOnly, the container runs non-root,
  refresh cookies are path-restricted, secrets are separated by purpose.
- **Fail-closed** — bad config aborts boot; auth/CSRF failures deny; unknown
  errors become a generic 500.
- **Validate at trust boundaries** — every external input (env, body, params,
  headers) is validated before use.
- **Never trust client input / deny by default** — allowlists for CORS,
  ownership-scoped queries, strict zod schemas that reject unknown fields.

---

## Stack

| Concern             | Choice                                  |
| ------------------- | --------------------------------------- |
| Framework           | Next.js 15 App Router (Route Handlers)  |
| Language            | TypeScript (strict)                     |
| Validation          | [zod](https://zod.dev)                  |
| JWT                 | [jose](https://github.com/panva/jose) (HS256, access + refresh) |
| Password hashing    | [argon2](https://github.com/ranisalt/node-argon2) (Argon2id) |
| Headers / CSP / CORS| Custom middleware (helmet-equivalent)   |
| Data layer          | In-memory reference repo (swap for SQL/ORM) |

---

## Quick start

```bash
# 1) Install (NOT run by the generator)
npm install

# 2) Configure — copy the example and fill in REAL secrets
cp .env.example .env.local
# Generate strong secrets (use a DIFFERENT value for each):
openssl rand -base64 48   # JWT_ACCESS_SECRET
openssl rand -base64 48   # JWT_REFRESH_SECRET
openssl rand -base64 48   # SESSION_SECRET

# 3) Run (predev validates env and FAILS if misconfigured)
npm run dev
```

If env validation fails, the process prints the offending variable **names**
(never values) and exits non-zero — by design.

---

## Routes

| Method | Path                          | Auth        | Notes |
| ------ | ----------------------------- | ----------- | ----- |
| GET    | `/api/health`                 | none        | Liveness/readiness; minimal body |
| POST   | `/api/auth/jwt/register`      | none        | Create account (Argon2id) |
| POST   | `/api/auth/jwt/login`         | none        | Returns access token; sets refresh cookie |
| POST   | `/api/auth/jwt/refresh`       | refresh cookie | Rotates tokens |
| POST   | `/api/auth/jwt/logout`        | none        | Clears refresh cookie |
| POST   | `/api/auth/session/login`     | none        | Sets session + CSRF cookies |
| GET    | `/api/auth/session/csrf`      | session     | Returns CSRF token |
| POST   | `/api/auth/session/logout`    | session + CSRF | Destroys server-side session |
| GET    | `/api/notes`                  | bearer or session | Lists **your** notes |
| POST   | `/api/notes`                  | bearer or session(+CSRF) | Create note |
| GET    | `/api/notes/[id]`             | bearer or session | Read **owned** note |
| PATCH  | `/api/notes/[id]`             | bearer or session(+CSRF) | Update **owned** note |
| DELETE | `/api/notes/[id]`             | bearer or session(+CSRF) | Delete **owned** note |

### Example: JWT flow

```bash
BASE=http://localhost:3000

# register
curl -sS -X POST $BASE/api/auth/jwt/register \
  -H 'content-type: application/json' \
  -d '{"email":"a@example.com","password":"correct horse battery"}'

# login -> grab accessToken
TOKEN=$(curl -sS -X POST $BASE/api/auth/jwt/login \
  -H 'content-type: application/json' \
  -d '{"email":"a@example.com","password":"correct horse battery"}' | jq -r .accessToken)

# create a note (protected)
curl -sS -X POST $BASE/api/notes \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"title":"hello","body":"world"}'
```

### Example: session + CSRF flow

```bash
BASE=http://localhost:3000
JAR=cookies.txt

# login: stores session + csrf cookies in the jar, returns csrfToken
CSRF=$(curl -sS -c $JAR -X POST $BASE/api/auth/session/login \
  -H 'content-type: application/json' \
  -d '{"email":"a@example.com","password":"correct horse battery"}' | jq -r .csrfToken)

# state-changing request REQUIRES the CSRF header to match
curl -sS -b $JAR -X POST $BASE/api/notes \
  -H "x-csrf-token: $CSRF" \
  -H 'content-type: application/json' \
  -d '{"title":"via session","body":"csrf protected"}'
```

---

## THREAT MODEL (concise)

**Assets:** user credentials, session/refresh tokens, user-owned data (notes),
the signing secrets, and service availability.

**Trust boundaries:** the network edge (client → app), the platform → app config
(env), and the app → data store.

**Primary actors / threats considered (mapped to [OWASP Top 10:2021](https://owasp.org/Top10/)):**

| Threat | OWASP | Mitigation in this starter |
| ------ | ----- | -------------------------- |
| Broken access control / IDOR | A01 | All reads/writes scoped by owner id in the query; redundant `assertOwnership`; not-owned → 404 (no enumeration) |
| Weak/leaked crypto, weak secrets | A02 | Argon2id hashing; HS256 JWT with pinned `alg`/`iss`/`aud`; boot rejects short/placeholder/duplicate secrets |
| Injection (SQL/NoSQL/command) | A03 | zod validation at boundaries; **parameterized-query only** data layer (see `src/lib/db/index.ts`); no `eval`, no string-built queries |
| Insecure design | A04 | Centralized error handling, fail-closed defaults, separation of authn/authz |
| Security misconfiguration | A05 | Strict CSP + secure headers via middleware; `poweredByHeader:false`; env schema; non-root container; no secrets in image |
| Vulnerable components | A06 | Pinned deps; documented patch process (you must run `npm audit` / Dependabot) |
| Auth failures / brute force | A07 | Strict auth-tier rate limiting; generic errors; anti-enumeration constant-work login |
| Software/data integrity | A08 | Standalone build, pinned base image (pin by digest in your registry), `.dockerignore` |
| Logging/monitoring gaps | A09 | Structured JSON logs with secret redaction + per-request correlation id (you must ship them to a SIEM + alert) |
| SSRF | A10 | No server-side fetch of user-supplied URLs in this starter; if you add any, allowlist destinations |
| CSRF (cookie auth) | — | SameSite cookies + double-submit token bound to the server session, enforced on unsafe methods |
| Clickjacking | — | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` |
| MIME sniffing | — | `X-Content-Type-Options: nosniff` |
| Transport downgrade | — | HSTS (preload) in production |

**Explicitly OUT of scope for this starter (you must address):** WAF/edge DDoS
protection, account lockout/MFA, email verification & password reset, audit
trails, secret rotation, a real persistent database, distributed rate limiting,
and bot/abuse detection.

---

## What's protected (out of the box)

- **Boot-time env validation** (`src/env.ts`): fail-closed; secrets must be
  ≥ 32 chars, non-placeholder, and mutually distinct.
- **Secure headers + strict CSP** on every response (`src/middleware.ts`,
  `src/lib/http/security-headers.ts`): `default-src 'none'`, HSTS in prod,
  nosniff, frame-deny, no-referrer, Permissions-Policy, COOP/CORP, `no-store`.
- **Strict allowlist CORS** (`src/lib/http/cors.ts`): deny-by-default, exact
  origins only, `Vary: Origin`, credentialed without wildcard.
- **Rate limiting** (`src/lib/http/rate-limit.ts`): strict auth tier + global
  tier; standard `X-RateLimit-*` + `Retry-After`.

> ### ⚠️ Rate limiting in production
> The default token-bucket limiter in `src/lib/http/rate-limit.ts` is **in-memory
> and per-process**. Behind multiple load-balanced instances (or serverless
> replicas), each process keeps its own counters, so an attacker who round-robins
> across instances multiplies the effective limit by the number of instances.
> **Multi-instance deployments MUST use a shared store (Redis / Upstash)** so limits
> hold across replicas. (Call sites don't change.)
- **Request validation** (`src/lib/http/validate.ts` + `src/lib/schemas.ts`):
  content-type + size checks, strict zod schemas (unknown keys rejected),
  field-level safe error messages, UUID param validation.
- **Centralized, non-leaking errors** (`src/lib/http/errors.ts`): typed errors →
  safe JSON; unknown errors → generic 500; full detail only in server logs with
  a correlation id.
- **Secret-safe structured logging** (`src/lib/logger.ts`): JSON lines, deep
  redaction of sensitive keys, no bodies/cookies/authorization logged.
- **Argon2id password hashing** (`src/lib/auth/password.ts`): memory-hard,
  fail-closed verify.
- **JWT access + refresh** (`src/lib/auth/jwt.ts`): separate secrets, pinned
  alg/iss/aud, typed tokens, rotation on refresh.
- **Session-cookie auth** (`src/lib/auth/session.ts`, `cookies.ts`): HMAC-signed
  opaque session id, server-side store (instant revoke), HttpOnly + Secure +
  `__Host-` + SameSite, path-scoped refresh cookie.
- **CSRF for the cookie path** (`src/lib/auth/csrf.ts`): double-submit token
  bound to the session, constant-time compare, unsafe-method-only.
- **Ownership/authz** (`src/lib/auth/authz.ts` + notes routes): owner-scoped
  queries + redundant checks; 404 on not-owned.
- **/health** probe and **graceful shutdown** (`src/instrumentation.ts`):
  SIGTERM/SIGINT handling with a bounded force-exit timer.
- **Hardened container** (`Dockerfile`): multi-stage, non-root, minimal,
  no baked secrets, healthcheck.

---

## What you STILL must do (production checklist)

This starter gives you a strong baseline. Before shipping, you are responsible
for:

- [ ] **Persistent database** — replace the in-memory repo. Keep the
      parameterized-query rule (see `src/lib/db/index.ts`). Add migrations.
- [ ] **Distributed rate limiting** — swap the in-memory limiter for Redis /
      Upstash so limits hold across replicas. (Call sites don't change.)
- [ ] **Refresh-token revocation** — persist JTIs, detect reuse, revoke families
      (true logout-everywhere). Stateless access tokens still expire by TTL only.
- [ ] **Account security** — email verification, password reset (secure tokens),
      account lockout / progressive delays, and **MFA**.
- [ ] **TLS + HSTS preload** — terminate HTTPS at the edge; confirm HSTS; submit
      to the preload list only when you're certain.
- [ ] **Secret management** — load secrets from a vault/KMS, rotate regularly,
      never commit. `.env.local` is gitignored.
- [ ] **CSP for any UI** — if you add HTML/JS pages, use a per-request nonce;
      never add `'unsafe-inline'`.
- [ ] **Observability** — ship the structured logs to a SIEM; alert on auth
      failures, rate-limit spikes, and 5xx rates. Add tracing/metrics.
- [ ] **Dependency hygiene** — enable Dependabot/Renovate; run `npm audit` in CI;
      pin the Docker base image by **digest** in your registry.
- [ ] **Edge protections** — WAF, bot management, and L3/L4 + L7 DDoS mitigation.
- [ ] **AuthN/AuthZ hardening** — add roles/scopes if you need RBAC/ABAC beyond
      simple ownership; review every new route for an explicit authz check.
- [ ] **Pen test & threat-model review** before launch and after major changes.

---

## Project structure

```
src/
  env.ts                         # zod env schema, validated at boot (fail-closed)
  middleware.ts                  # security headers + CORS + preflight (edge)
  instrumentation.ts             # boot validation + graceful shutdown
  lib/
    logger.ts                    # secret-safe structured logging
    schemas.ts                   # shared zod request schemas
    auth/
      password.ts                # Argon2id hash/verify
      jwt.ts                     # access + refresh (jose, HS256)
      session.ts                 # signed opaque server-side sessions
      cookies.ts                 # cookie names + secure attributes
      csrf.ts                    # double-submit CSRF for the cookie path
      authz.ts                   # requireUser + assertOwnership
    db/
      index.ts                   # in-memory repo (parameterized-query pattern)
    http/
      errors.ts                  # typed errors + non-leaking responder
      handler.ts                 # withRoute wrapper (logging, errors, headers)
      respond.ts                 # JSON/no-content helpers (CORS merged)
      validate.ts                # body/param parsing + zod
      cors.ts                    # strict allowlist CORS
      security-headers.ts        # helmet-equivalent headers + CSP
      rate-limit.ts              # auth + global tiers
  app/
    api/
      health/route.ts
      auth/jwt/{register,login,refresh,logout}/route.ts
      auth/session/{login,logout,csrf}/route.ts
      notes/route.ts
      notes/[id]/route.ts
scripts/check-env.ts             # pre{dev,build} env guard
Dockerfile / .dockerignore       # hardened, non-root, minimal image
.env.example                     # NO real secrets
```

---

## Docker

```bash
# Build (generate a package-lock.json first via `npm install` for reproducibility)
docker build -t hardened-api .

# Run — inject REAL secrets at runtime (never bake them into the image)
docker run --rm -p 3000:3000 --env-file .env.local hardened-api
```

The image runs as a non-root user, contains no secrets, and exposes a
`/api/health` healthcheck. Pin the base image by digest in your own registry.

---

## License

Use freely as a starting point. Review and adapt for your own threat model.
