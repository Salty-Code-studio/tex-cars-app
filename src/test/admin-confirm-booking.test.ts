// c58b0a5 (port) gated POST /api/admin/bookings/[id]/confirm to desk
// deployments only (online bookings are confirmed by the Stripe webhook
// instead). Set BEFORE any import, and every app-code import below is
// DYNAMIC (not static): a static `import ... from "@/lib/..."` is hoisted by
// ESM ahead of this file's own top-level code no matter where it is written
// textually, so it would resolve (and freeze) "@/env" at its default stripe
// mode before these lines ever ran. Matches the same all-dynamic-imports
// convention every other desk-mode test file in this port uses.
// NEXT_PUBLIC_PAYMENT_MODE must match PAYMENT_MODE (src/env.ts's superRefine).
process.env.PAYMENT_MODE = "desk";
process.env.NEXT_PUBLIC_PAYMENT_MODE = "desk";

/**
 * Admin Confirm action: confirmBookingAdmin service (now src/lib/admin/
 * confirm-booking.ts, ported from FD's desk-mode lineage 2026-08-19 -
 * ffa9733 - superseding the old move-booking.ts version), the
 * POST /api/admin/bookings/[id]/confirm route (desk-mode gated as of
 * c58b0a5), and notifyReservationConfirmed (retirement tracked separately
 * once notifyBookingConfirmed's own paid/unpaid copy branch lands - see
 * a3d06a0 in the port ledger).
 *
 * The route-level tests mock next/headers exactly like admin-reset-owner.test.ts
 * (requireAdmin/enforceCsrf read cookies via Next's request-scoped
 * AsyncLocalStorage, which vitest doesn't provide outside a real request).
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

// Broad dynamic-module handles (this file's whole point is deferring these
// imports past the process.env lines above - see the file-header comment),
// narrowed by each helper function below rather than typed precisely here.
/* eslint-disable @typescript-eslint/no-explicit-any */
let mod: any;
let db: any;
/* eslint-enable @typescript-eslint/no-explicit-any */
let vehicleId = "";
let confirmPOST: typeof import("@/app/api/admin/bookings/[id]/confirm/route").POST;

beforeAll(async () => {
  mod = {
    eq: (await import("drizzle-orm")).eq,
    desc: (await import("drizzle-orm")).desc,
    getDb: (await import("@/lib/db/client")).getDb,
    runMigrations: (await import("@/lib/db/migrate")).runMigrations,
    schema: await import("@/lib/db/schema"),
    createSession: (await import("@/lib/auth/sessions")).createSession,
    cookies: await import("@/lib/auth/cookies"),
    confirmBookingAdmin: (await import("@/lib/admin/confirm-booking")).confirmBookingAdmin,
    cancelBookingAdmin: (await import("@/lib/admin/move-booking")).cancelBookingAdmin,
    notifyReservationConfirmed: (await import("@/lib/email/notifications")).notifyReservationConfirmed,
    reservationConfirmedEmail: (await import("@/lib/email/templates")).reservationConfirmedEmail,
    atAruba: (await import("@/lib/time/format")).atAruba,
    expectReject: (await import("./util")).expectReject,
  };
  confirmPOST = (await import("@/app/api/admin/bookings/[id]/confirm/route")).POST;

  db = await mod.getDb();
  await mod.runMigrations();
  await db.insert(mod.schema.settings).values({ id: 1 }).onConflictDoNothing();
  const [v] = await db.insert(mod.schema.vehicles).values({
    slug: "cb-1", plate: "CB-1", class: "SUV", name: "Confirm Car", seats: 5, transmission: "Automatic",
    doors: 5, priceDayCents: 5800, priceWeekCents: 34800, priceMonthCents: 118000,
  }).returning();
  vehicleId = v!.id;
});

async function makePendingBooking(opts: { email: string; startDate: string; endDate: string; status?: "pending" | "confirmed" | "cancelled" | "completed" }) {
  const [c] = await db.insert(mod.schema.customers).values({ email: opts.email, name: "Confirm Test" }).returning();
  const startAt = mod.atAruba(opts.startDate, "09:00");
  const endAt = mod.atAruba(opts.endDate, "09:00");
  const [bk] = await db.insert(mod.schema.bookings).values({
    vehicleId, customerId: c!.id, startAt, endAt,
    bufferEndAt: endAt, status: opts.status ?? "pending",
    priceBreakdown: { subtotalCents: 12000, currency: "USD" }, paymentOption: "full",
    acceptedPolicyVersion: 0, acceptedAt: new Date(),
    idempotencyKey: `confirm-${opts.email}-${opts.startDate}-${opts.endDate}`,
  }).returning();
  return bk!;
}

async function makeAdmin(email: string, role: "owner" | "staff" = "owner") {
  const [admin] = await db.insert(mod.schema.adminUsers).values({ email, passwordHash: "x", role, mfaEnabled: true }).returning();
  return admin!;
}

async function authedRequest(adminId: string, url: string, method: string, opts: { withCsrf?: boolean } = {}) {
  const { withCsrf = true } = opts;
  const s = await mod.createSession({ subjectType: "admin", subjectId: adminId, mfaPending: false });
  cookieState.header = `${mod.cookies.SESSION_COOKIE}=${s.cookieValue}; ${mod.cookies.CSRF_COOKIE}=${s.csrfToken}`;
  const headers: Record<string, string> = { origin: "http://localhost:3000", cookie: cookieState.header };
  if (withCsrf) headers["x-csrf-token"] = s.csrfToken;
  return new Request(`http://localhost:3000${url}`, { method, headers });
}

describe("confirmBookingAdmin (service)", () => {
  it("promotes a pending booking straight to confirmed", async () => {
    const bk = await makePendingBooking({ email: "svc-pending@test.com", startDate: "2029-01-01", endDate: "2029-01-05" });
    const confirmed = await mod.confirmBookingAdmin(bk.id, "Test Admin");
    expect(confirmed.status).toBe("confirmed");
    const [row] = await db.select().from(mod.schema.bookings).where(mod.eq(mod.schema.bookings.id, bk.id));
    expect(row!.status).toBe("confirmed");
  });

  it("rejects an already-confirmed booking (conflict)", async () => {
    const bk = await makePendingBooking({ email: "svc-conf@test.com", startDate: "2029-02-01", endDate: "2029-02-05", status: "confirmed" });
    await mod.expectReject(mod.confirmBookingAdmin(bk.id, "Test Admin"), /only a pending booking can be confirmed/i);
  });

  it("rejects a cancelled booking (conflict)", async () => {
    const bk = await makePendingBooking({ email: "svc-cancel@test.com", startDate: "2029-03-01", endDate: "2029-03-05" });
    await mod.cancelBookingAdmin(bk.id, false, new Date().toISOString());
    await mod.expectReject(mod.confirmBookingAdmin(bk.id, "Test Admin"), /only a pending booking can be confirmed/i);
  });

  it("rejects a completed booking (conflict)", async () => {
    const bk = await makePendingBooking({ email: "svc-done@test.com", startDate: "2029-04-01", endDate: "2029-04-05", status: "completed" });
    await mod.expectReject(mod.confirmBookingAdmin(bk.id, "Test Admin"), /only a pending booking can be confirmed/i);
  });
});

describe("POST /api/admin/bookings/[id]/confirm (route)", () => {
  it("owner with CSRF confirms the booking and writes an audit row", async () => {
    const owner = await makeAdmin("confirm-owner-a@test.com", "owner");
    const bk = await makePendingBooking({ email: "route-owner@test.com", startDate: "2029-05-01", endDate: "2029-05-05" });

    const res = await confirmPOST(
      await authedRequest(owner.id, `/api/admin/bookings/${bk.id}/confirm`, "POST"),
      { params: Promise.resolve({ id: bk.id }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("confirmed");

    const [audit] = await db.select().from(mod.schema.auditLog)
      .where(mod.eq(mod.schema.auditLog.action, "admin.booking_confirmed"))
      .orderBy(mod.desc(mod.schema.auditLog.createdAt)).limit(1);
    expect(audit).toBeDefined();
    expect(audit!.entityId).toBe(bk.id);
  });

  it("staff can confirm too (desk-mode adoption widened this route's roles to owner+staff)", async () => {
    const staff = await makeAdmin("confirm-staff-a@test.com", "staff");
    const bk = await makePendingBooking({ email: "route-staff@test.com", startDate: "2029-06-01", endDate: "2029-06-05" });
    const res = await confirmPOST(
      await authedRequest(staff.id, `/api/admin/bookings/${bk.id}/confirm`, "POST"),
      { params: Promise.resolve({ id: bk.id }) },
    );
    expect(res.status).toBe(200);
    const [row] = await db.select().from(mod.schema.bookings).where(mod.eq(mod.schema.bookings.id, bk.id));
    expect(row!.status).toBe("confirmed");
    // Same audit trail as the owner path: mutate() sets actor to the acting
    // admin's id regardless of role.
    const [audit] = await db.select().from(mod.schema.auditLog)
      .where(mod.eq(mod.schema.auditLog.entityId, bk.id))
      .orderBy(mod.desc(mod.schema.auditLog.createdAt)).limit(1);
    expect(audit!.actor).toBe(staff.id);
  });

  it("missing CSRF header is rejected", async () => {
    const owner = await makeAdmin("confirm-owner-b@test.com", "owner");
    const bk = await makePendingBooking({ email: "route-nocsrf@test.com", startDate: "2029-07-01", endDate: "2029-07-05" });
    const res = await confirmPOST(
      await authedRequest(owner.id, `/api/admin/bookings/${bk.id}/confirm`, "POST", { withCsrf: false }),
      { params: Promise.resolve({ id: bk.id }) },
    );
    expect([401, 403]).toContain(res.status);
    const [row] = await db.select().from(mod.schema.bookings).where(mod.eq(mod.schema.bookings.id, bk.id));
    expect(row!.status).toBe("pending");
  });
});

describe("notifyReservationConfirmed", () => {
  it("logs a customer email with the confirmed-reservation subject and NO payment wording", async () => {
    const bk = await makePendingBooking({ email: "notify-confirm@test.com", startDate: "2029-08-01", endDate: "2029-08-05" });
    await mod.confirmBookingAdmin(bk.id, "Test Admin");
    await mod.notifyReservationConfirmed(bk.id);

    const [log] = await db.select().from(mod.schema.emailLog)
      .where(mod.eq(mod.schema.emailLog.to, "notify-confirm@test.com"))
      .orderBy(mod.desc(mod.schema.emailLog.createdAt)).limit(1);
    expect(log).toBeDefined();
    expect(log!.type).toBe("reservation_confirmed");

    const rendered = mod.reservationConfirmedEmail({ vehicleName: "Confirm Car", startAt: mod.atAruba("2029-08-01", "09:00"), endAt: mod.atAruba("2029-08-05", "09:00") });
    expect(rendered.subject).toBe("Your Tex Cars reservation is confirmed");
    expect(rendered.html.toLowerCase()).not.toContain("payment");
    expect(rendered.html.toLowerCase()).not.toContain("paid");
    expect(rendered.html).toContain("You pay the deposit at pickup. See you soon!");
    expect(rendered.subject).not.toContain("—");
    expect(rendered.html).not.toContain("—");
  });

  it("writes a booking.confirmed_manual admin notification row", async () => {
    const bk = await makePendingBooking({ email: "notify-admin-row@test.com", startDate: "2029-09-01", endDate: "2029-09-05" });
    await mod.confirmBookingAdmin(bk.id, "Test Admin");
    await mod.notifyReservationConfirmed(bk.id);

    const [row] = await db.select().from(mod.schema.notifications)
      .where(mod.eq(mod.schema.notifications.type, "booking.confirmed_manual"))
      .orderBy(mod.desc(mod.schema.notifications.createdAt)).limit(1);
    expect(row).toBeDefined();
    expect(row!.bookingId).toBe(bk.id);
  });

  it("is best-effort: resolves void even for a booking id that no longer resolves to a full row", async () => {
    await expect(mod.notifyReservationConfirmed("00000000-0000-0000-0000-000000000000")).resolves.toBeUndefined();
  });
});
