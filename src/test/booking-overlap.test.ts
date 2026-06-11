import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { vehicles, customers, bookings } from "@/lib/db/schema";
import { expectReject } from "./util";

let db: Awaited<ReturnType<typeof getDb>>;
let vehicleId = "";
let customerId = "";

const mkBooking = (
  start: string,
  end: string,
  key: string,
  status: "pending" | "confirmed" | "cancelled" = "confirmed",
) => ({
  vehicleId, customerId, startDate: start, endDate: end, status,
  priceBreakdown: { totalCents: 10000 },
  paymentOption: "reservation_fee" as const,
  acceptedPolicyVersion: 1,
  acceptedAt: new Date(),
  idempotencyKey: key,
});

beforeAll(async () => {
  db = await getDb();
  await runMigrations();
  const [v] = await db.insert(vehicles).values({
    slug: "test-car", class: "SUV", name: "Test Car", seats: 5, transmission: "Automatic",
    doors: 5, priceDayCents: 5800, priceWeekCents: 34800, priceMonthCents: 118000,
  }).returning({ id: vehicles.id });
  const [c] = await db.insert(customers).values({ email: "t@t.com" }).returning({ id: customers.id });
  vehicleId = v!.id;
  customerId = c!.id;
});

describe("bookings_no_overlap exclusion constraint", () => {
  it("accepts a booking", async () => {
    await expect(db.insert(bookings).values(mkBooking("2026-07-01", "2026-07-08", "k1"))).resolves.toBeDefined();
  });

  it("physically rejects an overlapping booking for the same vehicle", async () => {
    await expectReject(
      db.insert(bookings).values(mkBooking("2026-07-05", "2026-07-10", "k2")),
      /bookings_no_overlap|exclusion/i,
    );
  });

  it("allows back-to-back ranges (exclusive end date)", async () => {
    await expect(db.insert(bookings).values(mkBooking("2026-07-08", "2026-07-12", "k3"))).resolves.toBeDefined();
  });

  it("a pending booking also blocks the range", async () => {
    await db.insert(bookings).values(mkBooking("2026-08-10", "2026-08-15", "k-pending", "pending"));
    await expectReject(
      db.insert(bookings).values(mkBooking("2026-08-12", "2026-08-20", "k-clash")),
      /bookings_no_overlap|exclusion/i,
    );
  });

  it("a cancelled booking frees its range", async () => {
    await db.insert(bookings).values(mkBooking("2026-08-01", "2026-08-05", "k4", "cancelled"));
    await expect(db.insert(bookings).values(mkBooking("2026-08-01", "2026-08-05", "k5"))).resolves.toBeDefined();
  });

  it("rejects duplicate idempotency keys", async () => {
    await expectReject(
      db.insert(bookings).values(mkBooking("2026-09-01", "2026-09-05", "k5")),
      /unique|duplicate/i,
    );
  });

  it("rejects end <= start", async () => {
    await expectReject(
      db.insert(bookings).values(mkBooking("2026-10-05", "2026-10-05", "k6")),
      /bookings_dates|check/i,
    );
  });
});
