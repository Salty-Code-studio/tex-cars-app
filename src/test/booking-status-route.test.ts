import { describe, it, expect, beforeAll } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { getDb } from "@/lib/db/client";
import { bookings, customers, vehicles } from "@/lib/db/schema";
import { GET } from "@/app/api/bookings/[id]/route";

/**
 * Task 4 (confirmation page redesign) needs the class + car name to render
 * the summary card, so the route grew a left join on vehicles alongside the
 * existing no-PII status fields. This pins the additive shape: everything
 * the confirmation page already relied on is still there, plus the two new
 * fields, and still nothing customer-identifying.
 */

function get(id: string) {
  const req = new Request(`http://localhost:3000/api/bookings/${id}`, {
    headers: { "user-agent": "booking-status-route-test" },
  });
  return GET(req, { params: Promise.resolve({ id }) });
}

const breakdown = {
  days: 3, vehicleCents: 15000, insuranceCents: 0, addOns: [], addOnsCents: 0,
  subtotalCents: 15000, depositCents: 20000, youngDriverCents: 0, youngDriver: false,
  depositPercent: 25, depositMinCents: 3000, currency: "USD",
};

beforeAll(async () => {
  await runMigrations();
});

describe("GET /api/bookings/[id]", () => {
  it("includes the vehicle class and name alongside the existing no-PII fields", async () => {
    const db = await getDb();
    const [v] = await db.insert(vehicles).values({
      slug: "status-route-car", plate: "STATUS-RT", class: "SUV", name: "Status Route Car", status: "active",
      seats: 5, transmission: "Automatic", doors: 5,
      priceDayCents: 5000, priceWeekCents: 30000, priceMonthCents: 100000, depositCents: 20000,
    }).returning();
    const [c] = await db.insert(customers).values({ email: "status-route@example.com", name: "Route Cust", phone: "+297 555 0000" }).returning();
    const [b] = await db.insert(bookings).values({
      vehicleId: v!.id, customerId: c!.id,
      startAt: "2028-01-01T09:00:00-04:00", endAt: "2028-01-04T09:00:00-04:00",
      bufferEndAt: "2028-01-05T09:00:00-04:00", status: "pending",
      priceBreakdown: breakdown, paymentOption: "full",
      acceptedPolicyVersion: 0, acceptedAt: new Date(), idempotencyKey: "status-route-key-1",
    }).returning();

    const res = await get(b!.id);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toMatchObject({
      id: b!.id, status: "pending", paymentOption: "full",
      vehicleClass: "SUV", vehicleName: "Status Route Car",
    });
    expect(body.priceBreakdown).toMatchObject(breakdown);

    // Still no PII: never the customer's name, email, phone, or licence.
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("status-route@example.com");
    expect(serialized).not.toContain("Route Cust");
    expect(serialized).not.toContain("555 0000");
  });

  it("404s for an unknown id (unaffected by the join)", async () => {
    const res = await get("11111111-1111-1111-1111-111111111111");
    expect(res.status).toBe(404);
  });
});
