/**
 * Admin Confirm action: confirmBookingAdmin service (now src/lib/admin/
 * confirm-booking.ts, ported from FD's desk-mode lineage 2026-08-19 -
 * ffa9733 - superseding the old move-booking.ts version), the
 * POST /api/admin/bookings/[id]/confirm route, and notifyReservationConfirmed
 * (retirement tracked separately once notifyBookingConfirmed's own paid/
 * unpaid copy branch lands - see a3d06a0 in the port ledger).
 *
 * The route-level tests mock next/headers exactly like admin-reset-owner.test.ts
 * (requireAdmin/enforceCsrf read cookies via Next's request-scoped
 * AsyncLocalStorage, which vitest doesn't provide outside a real request).
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { vehicles, settings, customers, bookings, auditLog, emailLog, notifications, adminUsers } from "@/lib/db/schema";
import { createSession } from "@/lib/auth/sessions";
import { SESSION_COOKIE, CSRF_COOKIE } from "@/lib/auth/cookies";
import { confirmBookingAdmin } from "@/lib/admin/confirm-booking";
import { cancelBookingAdmin } from "@/lib/admin/move-booking";
import { notifyReservationConfirmed } from "@/lib/email/notifications";
import { reservationConfirmedEmail } from "@/lib/email/templates";
import { atAruba } from "@/lib/time/format";
import { expectReject } from "./util";

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

import { POST as confirmPOST } from "@/app/api/admin/bookings/[id]/confirm/route";

let db: Awaited<ReturnType<typeof getDb>>;
let vehicleId = "";

beforeAll(async () => {
  db = await getDb();
  await runMigrations();
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();
  const [v] = await db.insert(vehicles).values({
    slug: "cb-1", plate: "CB-1", class: "SUV", name: "Confirm Car", seats: 5, transmission: "Automatic",
    doors: 5, priceDayCents: 5800, priceWeekCents: 34800, priceMonthCents: 118000,
  }).returning();
  vehicleId = v!.id;
});

async function makePendingBooking(opts: { email: string; startDate: string; endDate: string; status?: "pending" | "confirmed" | "cancelled" | "completed" }) {
  const [c] = await db.insert(customers).values({ email: opts.email, name: "Confirm Test" }).returning();
  const startAt = atAruba(opts.startDate, "09:00");
  const endAt = atAruba(opts.endDate, "09:00");
  const [bk] = await db.insert(bookings).values({
    vehicleId, customerId: c!.id, startAt, endAt,
    bufferEndAt: endAt, status: opts.status ?? "pending",
    priceBreakdown: { subtotalCents: 12000, currency: "USD" }, paymentOption: "full",
    acceptedPolicyVersion: 0, acceptedAt: new Date(),
    idempotencyKey: `confirm-${opts.email}-${opts.startDate}-${opts.endDate}`,
  }).returning();
  return bk!;
}

async function makeAdmin(email: string, role: "owner" | "staff" = "owner") {
  const [admin] = await db.insert(adminUsers).values({ email, passwordHash: "x", role, mfaEnabled: true }).returning();
  return admin!;
}

async function authedRequest(adminId: string, url: string, method: string, opts: { withCsrf?: boolean } = {}) {
  const { withCsrf = true } = opts;
  const s = await createSession({ subjectType: "admin", subjectId: adminId, mfaPending: false });
  cookieState.header = `${SESSION_COOKIE}=${s.cookieValue}; ${CSRF_COOKIE}=${s.csrfToken}`;
  const headers: Record<string, string> = { origin: "http://localhost:3000", cookie: cookieState.header };
  if (withCsrf) headers["x-csrf-token"] = s.csrfToken;
  return new Request(`http://localhost:3000${url}`, { method, headers });
}

describe("confirmBookingAdmin (service)", () => {
  it("promotes a pending booking straight to confirmed", async () => {
    const bk = await makePendingBooking({ email: "svc-pending@test.com", startDate: "2029-01-01", endDate: "2029-01-05" });
    const confirmed = await confirmBookingAdmin(bk.id, "Test Admin");
    expect(confirmed.status).toBe("confirmed");
    const [row] = await db.select().from(bookings).where(eq(bookings.id, bk.id));
    expect(row!.status).toBe("confirmed");
  });

  it("rejects an already-confirmed booking (conflict)", async () => {
    const bk = await makePendingBooking({ email: "svc-conf@test.com", startDate: "2029-02-01", endDate: "2029-02-05", status: "confirmed" });
    await expectReject(confirmBookingAdmin(bk.id, "Test Admin"), /only a pending booking can be confirmed/i);
  });

  it("rejects a cancelled booking (conflict)", async () => {
    const bk = await makePendingBooking({ email: "svc-cancel@test.com", startDate: "2029-03-01", endDate: "2029-03-05" });
    await cancelBookingAdmin(bk.id, false, new Date().toISOString());
    await expectReject(confirmBookingAdmin(bk.id, "Test Admin"), /only a pending booking can be confirmed/i);
  });

  it("rejects a completed booking (conflict)", async () => {
    const bk = await makePendingBooking({ email: "svc-done@test.com", startDate: "2029-04-01", endDate: "2029-04-05", status: "completed" });
    await expectReject(confirmBookingAdmin(bk.id, "Test Admin"), /only a pending booking can be confirmed/i);
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

    const [audit] = await db.select().from(auditLog)
      .where(eq(auditLog.action, "admin.booking_confirmed"))
      .orderBy(desc(auditLog.createdAt)).limit(1);
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
    const [row] = await db.select().from(bookings).where(eq(bookings.id, bk.id));
    expect(row!.status).toBe("confirmed");
    // Same audit trail as the owner path: mutate() sets actor to the acting
    // admin's id regardless of role.
    const [audit] = await db.select().from(auditLog)
      .where(eq(auditLog.entityId, bk.id))
      .orderBy(desc(auditLog.createdAt)).limit(1);
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
    const [row] = await db.select().from(bookings).where(eq(bookings.id, bk.id));
    expect(row!.status).toBe("pending");
  });
});

describe("notifyReservationConfirmed", () => {
  it("logs a customer email with the confirmed-reservation subject and NO payment wording", async () => {
    const bk = await makePendingBooking({ email: "notify-confirm@test.com", startDate: "2029-08-01", endDate: "2029-08-05" });
    await confirmBookingAdmin(bk.id, "Test Admin");
    await notifyReservationConfirmed(bk.id);

    const [log] = await db.select().from(emailLog)
      .where(eq(emailLog.to, "notify-confirm@test.com"))
      .orderBy(desc(emailLog.createdAt)).limit(1);
    expect(log).toBeDefined();
    expect(log!.type).toBe("reservation_confirmed");

    const rendered = reservationConfirmedEmail({ vehicleName: "Confirm Car", startAt: atAruba("2029-08-01", "09:00"), endAt: atAruba("2029-08-05", "09:00") });
    expect(rendered.subject).toBe("Your Tex Cars reservation is confirmed");
    expect(rendered.html.toLowerCase()).not.toContain("payment");
    expect(rendered.html.toLowerCase()).not.toContain("paid");
    expect(rendered.html).toContain("You pay the deposit at pickup. See you soon!");
    expect(rendered.subject).not.toContain("—");
    expect(rendered.html).not.toContain("—");
  });

  it("writes a booking.confirmed_manual admin notification row", async () => {
    const bk = await makePendingBooking({ email: "notify-admin-row@test.com", startDate: "2029-09-01", endDate: "2029-09-05" });
    await confirmBookingAdmin(bk.id, "Test Admin");
    await notifyReservationConfirmed(bk.id);

    const [row] = await db.select().from(notifications)
      .where(eq(notifications.type, "booking.confirmed_manual"))
      .orderBy(desc(notifications.createdAt)).limit(1);
    expect(row).toBeDefined();
    expect(row!.bookingId).toBe(bk.id);
  });

  it("is best-effort: resolves void even for a booking id that no longer resolves to a full row", async () => {
    await expect(notifyReservationConfirmed("00000000-0000-0000-0000-000000000000")).resolves.toBeUndefined();
  });
});
