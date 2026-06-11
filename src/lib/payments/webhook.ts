/**
 * Inbound Stripe webhook reducer (signature already verified by the route via
 * stripe.webhooks.constructEvent). Idempotent: a redelivered event id is a
 * no-op. Confirms a booking ONLY when a genuine paid event arrives whose amount
 * and currency match the expected charge, and only while the booking is still
 * pending (so a late/duplicate event can't resurrect a cancelled booking).
 */
import type Stripe from "stripe";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { bookings, payments, stripeWebhookEvents } from "@/lib/db/schema";
import { chargeForBooking, type PaymentOption } from "@/lib/payments/charge";
import type { QuoteBreakdown } from "@/lib/booking/quote";
import { logger } from "@/lib/logger";

export interface ProcessResult {
  handled: boolean;
  duplicate?: boolean;
  bookingConfirmed?: boolean;
}

/** Returns true if this event id is new (claimed), false if already processed. */
async function claimEvent(event: Stripe.Event): Promise<boolean> {
  const db = await getDb();
  const inserted = await db.insert(stripeWebhookEvents)
    .values({ eventId: event.id, type: event.type })
    .onConflictDoNothing({ target: stripeWebhookEvents.eventId })
    .returning({ eventId: stripeWebhookEvents.eventId });
  return inserted.length > 0;
}

export async function processStripeEvent(event: Stripe.Event): Promise<ProcessResult> {
  if (!(await claimEvent(event))) return { handled: true, duplicate: true };

  if (event.type !== "checkout.session.completed") {
    return { handled: true }; // acked + ignored
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") return { handled: true };

  const bookingId = session.metadata?.bookingId;
  if (!bookingId) {
    logger.warn("stripe_webhook_no_booking", { sessionId: session.id });
    return { handled: true };
  }

  const db = await getDb();
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!booking) {
    logger.warn("stripe_webhook_booking_missing", { bookingId });
    return { handled: true };
  }

  // Verify Stripe's paid amount/currency against what WE expect for this booking.
  const expected = chargeForBooking(booking.paymentOption as PaymentOption, booking.priceBreakdown as QuoteBreakdown);
  const paidAmount = session.amount_total ?? 0;
  const paidCurrency = (session.currency ?? "").toUpperCase();
  if (paidAmount !== expected.amountCents || paidCurrency !== expected.currency.toUpperCase()) {
    logger.error("stripe_webhook_amount_mismatch", { bookingId, paidAmount, expected: expected.amountCents, paidCurrency });
    return { handled: true }; // do NOT confirm on a mismatch
  }

  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;

  let bookingConfirmed = false;
  await db.transaction(async (tx) => {
    // Mark the payment row succeeded (it was created pending at checkout).
    await tx.update(payments)
      .set({ status: "succeeded", stripePaymentIntentId: paymentIntentId, updatedAt: new Date() })
      .where(eq(payments.stripeCheckoutSessionId, session.id));

    // Flip pending → confirmed (guarded: only if still pending).
    const flipped = await tx.update(bookings)
      .set({ status: "confirmed", updatedAt: new Date() })
      .where(and(eq(bookings.id, bookingId), eq(bookings.status, "pending")))
      .returning({ id: bookings.id });
    bookingConfirmed = flipped.length > 0;
  });

  return { handled: true, bookingConfirmed };
}
