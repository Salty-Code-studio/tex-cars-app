import { describe, it, expect, beforeAll } from "vitest";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { vehicles, customers, bookings, payments } from "@/lib/db/schema";
import { processStripeEvent } from "@/lib/payments/webhook";
import { getStripe } from "@/lib/payments/stripe-client";
import { env } from "@/env";

let db: Awaited<ReturnType<typeof getDb>>;
let vehicleId = "", customerId = "";

const breakdown = {
  days: 7, vehicleCents: 34800, insuranceCents: 0, addOns: [], addOnsCents: 0,
  subtotalCents: 34800, depositCents: 25000, reservationFeeCents: 3000, currency: "USD",
};

let dateCursor = 1;
async function makePendingBooking(key: string, sessionId: string) {
  // distinct non-overlapping dates per booking (same vehicle, buffered constraint)
  const month = String(dateCursor++).padStart(2, "0");
  const [b] = await db.insert(bookings).values({
    vehicleId, customerId, startDate: `2027-${month}-01`, endDate: `2027-${month}-08`, bufferEndDate: `2027-${month}-09`,
    status: "pending", priceBreakdown: breakdown, paymentOption: "reservation_fee",
    acceptedPolicyVersion: 1, acceptedAt: new Date(), idempotencyKey: key,
  }).returning();
  await db.insert(payments).values({
    bookingId: b!.id, stripeCheckoutSessionId: sessionId, type: "reservation_fee",
    amountCents: 3000, currency: "USD", status: "pending",
  });
  return b!;
}

function paidEvent(id: string, sessionId: string, bookingId: string, over: Partial<Stripe.Checkout.Session> = {}): Stripe.Event {
  return {
    id, type: "checkout.session.completed", object: "event", api_version: null,
    created: 0, livemode: false, pending_webhooks: 0, request: null,
    data: { object: {
      id: sessionId, object: "checkout.session", payment_status: "paid",
      amount_total: 3000, currency: "usd", payment_intent: `pi_${sessionId}`,
      metadata: { bookingId }, ...over,
    } as Stripe.Checkout.Session },
  } as Stripe.Event;
}

beforeAll(async () => {
  db = await getDb();
  await runMigrations();
  const [v] = await db.insert(vehicles).values({
    slug: "wh-car", class: "SUV", name: "WH Car", seats: 5, transmission: "Automatic",
    doors: 5, priceDayCents: 5800, priceWeekCents: 34800, priceMonthCents: 118000, depositCents: 25000,
  }).returning();
  const [c] = await db.insert(customers).values({ email: "wh@test.com" }).returning();
  vehicleId = v!.id; customerId = c!.id;
});

describe("processStripeEvent", () => {
  it("confirms the booking and marks the payment succeeded on a paid event", async () => {
    const b = await makePendingBooking("wh-1", "cs_test_1");
    const res = await processStripeEvent(paidEvent("evt_1", "cs_test_1", b.id));
    expect(res.bookingConfirmed).toBe(true);
    const [after] = await db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(after!.status).toBe("confirmed");
    const [pay] = await db.select().from(payments).where(eq(payments.stripeCheckoutSessionId, "cs_test_1"));
    expect(pay!.status).toBe("succeeded");
    expect(pay!.stripePaymentIntentId).toBe("pi_cs_test_1");
  });

  it("is idempotent: the same event id twice confirms once", async () => {
    const b = await makePendingBooking("wh-2", "cs_test_2");
    await processStripeEvent(paidEvent("evt_2", "cs_test_2", b.id));
    const dup = await processStripeEvent(paidEvent("evt_2", "cs_test_2", b.id));
    expect(dup.duplicate).toBe(true);
    const [after] = await db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(after!.status).toBe("confirmed");
  });

  it("does NOT confirm on an amount mismatch", async () => {
    const b = await makePendingBooking("wh-3", "cs_test_3");
    const res = await processStripeEvent(paidEvent("evt_3", "cs_test_3", b.id, { amount_total: 100 }));
    expect(res.bookingConfirmed).toBeFalsy();
    const [after] = await db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(after!.status).toBe("pending");
  });

  it("ignores an unpaid session and unknown event types", async () => {
    const b = await makePendingBooking("wh-4", "cs_test_4");
    const unpaid = await processStripeEvent(paidEvent("evt_4", "cs_test_4", b.id, { payment_status: "unpaid" }));
    expect(unpaid.bookingConfirmed).toBeFalsy();
    const other = await processStripeEvent({ id: "evt_5", type: "customer.created", data: { object: {} } } as Stripe.Event);
    expect(other.handled).toBe(true);
  });

  it("does not resurrect a cancelled booking", async () => {
    const b = await makePendingBooking("wh-6", "cs_test_6");
    await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, b.id));
    const res = await processStripeEvent(paidEvent("evt_6", "cs_test_6", b.id));
    expect(res.bookingConfirmed).toBe(false);
    const [after] = await db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(after!.status).toBe("cancelled");
  });

  it("verifies a real Stripe signature and rejects a tampered body", () => {
    const stripe = getStripe();
    const payload = JSON.stringify({ id: "evt_sig", type: "checkout.session.completed", data: { object: {} } });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_WEBHOOK_SECRET });
    expect(() => stripe.webhooks.constructEvent(payload, header, env.STRIPE_WEBHOOK_SECRET)).not.toThrow();
    expect(() => stripe.webhooks.constructEvent(payload + "x", header, env.STRIPE_WEBHOOK_SECRET)).toThrow();
  });
});
