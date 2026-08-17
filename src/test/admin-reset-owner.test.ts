/**
 * HTTP-level tests for the owner-only team list + reset-link mint routes.
 *
 * `requireAdmin`/`enforceCsrf` read cookies via next/headers `cookies()`,
 * which only works inside Next's own request-scoped AsyncLocalStorage. There
 * is no existing test in this suite that calls a `requireAdmin`-guarded route
 * handler directly (the other admin route tests exercise the service layer,
 * and the Task 3 reset routes are intentionally unauthenticated), so there is
 * no shared helper to reuse. We mock `next/headers` here to read from a
 * module-level "current request" cookie string set immediately before each
 * route call — safe because vitest runs these tests sequentially, never
 * concurrently, within this file.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { getDb } from "@/lib/db/client";
import { adminUsers } from "@/lib/db/schema";
import { createSession } from "@/lib/auth/sessions";
import { SESSION_COOKIE, CSRF_COOKIE } from "@/lib/auth/cookies";

const cookieState = vi.hoisted(() => ({ header: "" }));

// Hoisted above the imports below (vitest hoists all vi.mock calls to the
// top of the file), so admin-auth.ts and csrf.ts pick up this mock the
// moment they import "next/headers" transitively via the routes below.
vi.mock("next/headers", () => ({
  cookies: async () => {
    const jar = new Map<string, string>();
    for (const part of cookieState.header.split(";")) {
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      const key = part.slice(0, eq).trim();
      const value = part.slice(eq + 1).trim();
      if (key) jar.set(key, value);
    }
    return {
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    };
  },
}));

import { GET as usersGET } from "@/app/api/admin/users/route";
import { POST as resetLinkPOST } from "@/app/api/admin/users/[id]/reset-link/route";

beforeAll(async () => {
  await runMigrations();
});

async function makeAdmin(email: string, role: "owner" | "staff" = "owner") {
  const db = await getDb();
  const [admin] = await db
    .insert(adminUsers)
    .values({ email, passwordHash: "x", role, mfaEnabled: true })
    .returning();
  return admin!;
}

/** Builds an authenticated request AND arms the next/headers mock to match it. */
async function authedRequest(
  adminId: string,
  url: string,
  method: string,
  opts: { withCsrf?: boolean } = {},
) {
  const { withCsrf = true } = opts;
  const s = await createSession({ subjectType: "admin", subjectId: adminId, mfaPending: false });
  cookieState.header = `${SESSION_COOKIE}=${s.cookieValue}; ${CSRF_COOKIE}=${s.csrfToken}`;
  const headers: Record<string, string> = {
    origin: "http://localhost:3000",
    cookie: cookieState.header,
  };
  if (withCsrf) headers["x-csrf-token"] = s.csrfToken;
  return new Request(`http://localhost:3000${url}`, { method, headers });
}

describe("owner reset-link routes", () => {
  it("owner lists admins without secret fields and mints a link", async () => {
    const owner = await makeAdmin("owner-a@test.com", "owner");
    const target = await makeAdmin("mgr-a@test.com", "owner");

    const list = await usersGET(
      await authedRequest(owner.id, "/api/admin/users", "GET"),
      { params: Promise.resolve({}) },
    );
    expect(list.status).toBe(200);
    const body = await list.json();
    const entry = body.users.find((u: { email: string }) => u.email === "mgr-a@test.com");
    expect(entry).toBeDefined();
    expect(entry.passwordHash).toBeUndefined();
    expect(entry.mfaSecret).toBeUndefined();
    expect(entry.totpSecretEnc).toBeUndefined();

    const mint = await resetLinkPOST(
      await authedRequest(owner.id, `/api/admin/users/${target.id}/reset-link`, "POST"),
      { params: Promise.resolve({ id: target.id }) },
    );
    expect(mint.status).toBe(200);
    expect((await mint.json()).url).toContain("/admin/reset-password?token=");
  });

  it("staff cannot mint a reset link", async () => {
    const staff = await makeAdmin("staff-a@test.com", "staff");
    const target = await makeAdmin("mgr-b@test.com", "owner");
    const res = await resetLinkPOST(
      await authedRequest(staff.id, `/api/admin/users/${target.id}/reset-link`, "POST"),
      { params: Promise.resolve({ id: target.id }) },
    );
    expect([401, 403]).toContain(res.status);
  });

  it("staff cannot list admins either", async () => {
    const staff = await makeAdmin("staff-b@test.com", "staff");
    const res = await usersGET(
      await authedRequest(staff.id, "/api/admin/users", "GET"),
      { params: Promise.resolve({}) },
    );
    expect([401, 403]).toContain(res.status);
  });

  it("missing CSRF header is rejected", async () => {
    const owner = await makeAdmin("owner-b@test.com", "owner");
    const target = await makeAdmin("mgr-c@test.com", "owner");
    const req = await authedRequest(
      owner.id,
      `/api/admin/users/${target.id}/reset-link`,
      "POST",
      { withCsrf: false },
    );
    const res = await resetLinkPOST(req, { params: Promise.resolve({ id: target.id }) });
    expect([401, 403]).toContain(res.status);
  });
});
