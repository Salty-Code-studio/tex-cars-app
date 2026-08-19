/**
 * POST /api/admin/auth/demo (Task 7 gate fix).
 *
 * Before this fix the route only looked the demo admin up (findDemoAdmin) and
 * 404'd if it was absent; nothing anywhere (scripts/ or src/) ever called the
 * already-existing provisionDemoAdmin, so on any fresh environment the demo
 * door was permanently unreachable. This is also the first automated test of
 * the demo door at all: docs/PORT-LOG.md's wave-08 Concerns section notes the
 * suite had none.
 *
 * env.ts freezes `env` (including DEMO_MODE) at module-evaluation time, so
 * this file deliberately avoids every static top-level import of project code
 * and instead sets process.env.DEMO_MODE before the FIRST (dynamic) import of
 * anything that transitively pulls in @/env. vitest.config.ts runs the "forks"
 * pool with isolated module state per test file, so this cannot leak
 * DEMO_MODE=true into any other test file.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";

const cookieState = vi.hoisted(() => ({ header: "" }));

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

process.env.DEMO_MODE = "true";
process.env.NEXT_PUBLIC_DEMO_MODE = "true";

type DemoRoute = typeof import("@/app/api/admin/auth/demo/route");
type DemoLib = typeof import("@/lib/auth/demo");
type DbClient = typeof import("@/lib/db/client");

let db: Awaited<ReturnType<DbClient["getDb"]>>;
let POST: DemoRoute["POST"];
let findDemoAdmin: DemoLib["findDemoAdmin"];
let DEMO_ADMIN_EMAIL: string;

beforeAll(async () => {
  const { getDb } = await import("@/lib/db/client");
  const { runMigrations } = await import("@/lib/db/migrate");
  db = await getDb();
  await runMigrations();

  ({ POST } = await import("@/app/api/admin/auth/demo/route"));
  ({ findDemoAdmin, DEMO_ADMIN_EMAIL } = await import("@/lib/auth/demo"));
});

function demoRequest(): Request {
  return new Request("http://localhost:3000/api/admin/auth/demo", {
    method: "POST",
    headers: { origin: "http://localhost:3000" },
  });
}

describe("POST /api/admin/auth/demo (self-provisioning)", () => {
  it("provisions the demo admin on the first hit and returns ok:true with session cookies", async () => {
    expect(await findDemoAdmin(db)).toBeNull(); // fresh in-memory db, nothing provisioned yet

    const res = await POST(demoRequest(), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("set-cookie")).toBeTruthy();

    const admin = await findDemoAdmin(db);
    expect(admin).not.toBeNull();
    expect(admin!.email).toBe(DEMO_ADMIN_EMAIL);
    expect(admin!.role).toBe("owner");
    expect(admin!.mfaEnabled).toBe(true);
  });

  it("is idempotent: a second hit reuses the same admin row instead of duplicating it", async () => {
    const first = await POST(demoRequest(), { params: Promise.resolve({}) });
    expect(first.status).toBe(200);
    const afterFirst = await findDemoAdmin(db);

    const second = await POST(demoRequest(), { params: Promise.resolve({}) });
    expect(second.status).toBe(200);
    const afterSecond = await findDemoAdmin(db);

    expect(afterSecond!.id).toBe(afterFirst!.id);
  });
});
