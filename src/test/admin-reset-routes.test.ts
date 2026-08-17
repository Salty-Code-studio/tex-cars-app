import { describe, it, expect, beforeAll } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { getDb } from "@/lib/db/client";
import { adminUsers, adminResetTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { POST as requestPOST } from "@/app/api/admin/auth/reset/request/route";
import { POST as confirmPOST } from "@/app/api/admin/auth/reset/confirm/route";
import { mintResetLink } from "@/lib/auth/admin-reset";

beforeAll(async () => { await runMigrations(); });

function post(url: string, body: unknown): Request {
  return new Request(`http://localhost:3000${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify(body),
  });
}

// Route handlers are wrapped by withRoute, whose type always requires the
// Next.js route-context second argument (it destructures routeCtx?.params at
// runtime, but the exported handler's TS signature is non-optional). No
// dynamic segments here, so an empty params object satisfies it.
const noParams = { params: Promise.resolve({}) };

describe("POST /api/admin/auth/reset/request", () => {
  it("returns ok for unknown AND known emails (no enumeration)", async () => {
    const r1 = await requestPOST(post("/api/admin/auth/reset/request", { email: "ghost@test.com" }), noParams);
    expect(r1.status).toBe(200);
    expect(await r1.json()).toEqual({ ok: true });

    const db = await getDb();
    const [admin] = await db.insert(adminUsers).values({
      email: "route1@test.com", passwordHash: "x",
    }).returning();
    const adminId = admin!.id;
    const r2 = await requestPOST(post("/api/admin/auth/reset/request", { email: "route1@test.com" }), noParams);
    expect(r2.status).toBe(200);
    expect(await r2.json()).toEqual({ ok: true });
    const rows = await db.select().from(adminResetTokens).where(eq(adminResetTokens.adminUserId, adminId));
    expect(rows.length).toBe(1);
  });

  it("422s a malformed email", async () => {
    const r = await requestPOST(post("/api/admin/auth/reset/request", { email: "not-an-email" }), noParams);
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
});

describe("POST /api/admin/auth/reset/confirm", () => {
  it("resets with a valid token, 400s on reuse", async () => {
    const db = await getDb();
    const [admin] = await db.insert(adminUsers).values({
      email: "route2@test.com", passwordHash: "x",
    }).returning();
    const adminId = admin!.id;
    const url = await mintResetLink(adminId);
    const token = new URL(url).searchParams.get("token")!;
    const ok = await confirmPOST(post("/api/admin/auth/reset/confirm", { token, password: "a-long-enough-password-1" }), noParams);
    expect(ok.status).toBe(200);
    const reuse = await confirmPOST(post("/api/admin/auth/reset/confirm", { token, password: "a-long-enough-password-1" }), noParams);
    expect(reuse.status).toBe(400);
  });

  it("422s a short password without consuming the token", async () => {
    const db = await getDb();
    const [admin] = await db.insert(adminUsers).values({
      email: "route3@test.com", passwordHash: "x",
    }).returning();
    const adminId = admin!.id;
    const url = await mintResetLink(adminId);
    const token = new URL(url).searchParams.get("token")!;
    const weak = await confirmPOST(post("/api/admin/auth/reset/confirm", { token, password: "short" }), noParams);
    expect(weak.status).toBeGreaterThanOrEqual(400);
    // token still valid afterwards
    const ok = await confirmPOST(post("/api/admin/auth/reset/confirm", { token, password: "a-long-enough-password-1" }), noParams);
    expect(ok.status).toBe(200);
  });
});
