import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { getDb } from "@/lib/db/client";
import { vehicles, customers, bookings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * PAYMENT_MODE env shape + reserve-mode guards on the payments modules.
 * Follows the env-override style in env-validation.test.ts (snapshot + hard
 * restore process.env, vi.resetModules() before every dynamic re-import of
 * @/env or anything that imports it) and the fixture style in
 * payments-checkout-guard.test.ts / payments-holds.test.ts.
 */

const ORIGINAL = { ...process.env };
function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL);
}

let db: Awaited<ReturnType<typeof getDb>>;
let vehicleId = "", customerId = "";

beforeAll(async () => {
  db = await getDb();
  await runMigrations();
  const [v] = await db.insert(vehicles).values({
    slug: "rm-car", plate: "PL-rm-car", class: "SUV", name: "Reserve Mode Car", seats: 5, transmission: "Automatic",
    doors: 5, priceDayCents: 5800, priceWeekCents: 34800, priceMonthCents: 118000, depositCents: 25000,
  }).returning();
  const [c] = await db.insert(customers).values({ email: "rm@test.com" }).returning();
  vehicleId = v!.id; customerId = c!.id;
});

describe("PAYMENT_MODE env", () => {
  beforeEach(() => vi.resetModules());
  afterEach(restoreEnv);

  it("reserve mode validates WITHOUT stripe keys", async () => {
    process.env.PAYMENT_MODE = "reserve";
    process.env.NEXT_PUBLIC_PAYMENT_MODE = "reserve";
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { env } = await import("@/env");
    expect(env.PAYMENT_MODE).toBe("reserve");
    expect(env.STRIPE_SECRET_KEY).toBe("");
    expect(env.STRIPE_WEBHOOK_SECRET).toBe("");
  });

  it("stripe mode without stripe keys fails validation", async () => {
    process.env.PAYMENT_MODE = "stripe";
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(import("@/env")).rejects.toThrow(/environment validation failed/i);
      const printed = spy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(printed).toContain("STRIPE_SECRET_KEY");
      expect(printed).toContain("STRIPE_WEBHOOK_SECRET");
    } finally {
      spy.mockRestore();
    }
  });

  it("defaults to stripe mode", async () => {
    delete process.env.PAYMENT_MODE;
    const { env } = await import("@/env");
    expect(env.PAYMENT_MODE).toBe("stripe");
  });

  it("rejects a present-but-malformed STRIPE_SECRET_KEY even in reserve mode", async () => {
    process.env.PAYMENT_MODE = "reserve";
    process.env.STRIPE_SECRET_KEY = "not-a-real-key";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(import("@/env")).rejects.toThrow(/environment validation failed/i);
      const printed = spy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(printed).toContain("STRIPE_SECRET_KEY");
    } finally {
      spy.mockRestore();
    }
  });

  it("rejects PAYMENT_MODE and NEXT_PUBLIC_PAYMENT_MODE when they disagree", async () => {
    process.env.PAYMENT_MODE = "reserve";
    process.env.NEXT_PUBLIC_PAYMENT_MODE = "stripe";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(import("@/env")).rejects.toThrow(/environment validation failed/i);
      const printed = spy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(printed).toContain("NEXT_PUBLIC_PAYMENT_MODE");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("reserve-mode guards", () => {
  beforeEach(() => vi.resetModules());
  afterEach(restoreEnv);

  it("createBookingCheckout throws conflict in reserve mode", async () => {
    process.env.PAYMENT_MODE = "reserve";
    process.env.NEXT_PUBLIC_PAYMENT_MODE = "reserve";
    const { createBookingCheckout } = await import("@/lib/payments/checkout");
    try {
      await createBookingCheckout("00000000-0000-0000-0000-000000000000", "http://localhost");
      throw new Error("expected createBookingCheckout to throw");
    } catch (e) {
      const err = e as { code?: string; message?: string };
      expect(err.code).toBe("conflict");
      expect(err.message).toMatch(/disabled/i);
    }
  });

  it("expireStaleHolds returns 0 and cancels nothing in reserve mode", async () => {
    const old = new Date(Date.now() - 60 * 60_000); // 60 min ago, well past any TTL
    const [b] = await db.insert(bookings).values({
      vehicleId, customerId, startDate: "2029-01-01", endDate: "2029-01-05", bufferEndDate: "2029-01-06",
      status: "pending", priceBreakdown: { subtotalCents: 1 }, paymentOption: "reservation_fee",
      acceptedPolicyVersion: 1, acceptedAt: new Date(), idempotencyKey: "rm-stale-hold", createdAt: old,
    }).returning();

    process.env.PAYMENT_MODE = "reserve";
    process.env.NEXT_PUBLIC_PAYMENT_MODE = "reserve";
    const { expireStaleHolds } = await import("@/lib/payments/holds");
    const n = await expireStaleHolds(30);
    expect(n).toBe(0);

    const [after] = await db.select().from(bookings).where(eq(bookings.id, b!.id));
    expect(after!.status).toBe("pending"); // untouched — reserve mode never auto-cancels
  });
});
