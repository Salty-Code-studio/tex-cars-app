/**
 * Create a Stripe Checkout Session for a pending booking. The amount is
 * recomputed server-side from the booking's snapshot; we record a pending
 * payment row and hand Stripe an inline price (no client-supplied money). The
 * hosted Checkout page handles all card data. Dynamic payment methods (no
 * payment_method_types) maximise conversion.
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { bookings, payments, vehicles } from "@/lib/db/schema";
import { Errors } from "@/lib/http/errors";
import { getStripe } from "@/lib/payments/stripe-client";
import { chargeForBooking, type PaymentOption } from "@/lib/payments/charge";
import type { QuoteBreakdown } from "@/lib/booking/quote";

const LABEL: Record<"reservation_fee" | "deposit", string> = {
  reservation_fee: "Reservation fee",
  deposit: "Security deposit",
};

export async function createBookingCheckout(bookingId: string, origin: string): Promise<{ url: string }> {
  const db = await getDb();
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  if (!booking) throw Errors.notFound("Booking not found");
  if (booking.status !== "pending") throw Errors.conflict("This booking is no longer awaiting payment");

  // Never start a second checkout once a payment has already succeeded — this is
  // the front-line guard against a double charge.
  const [paid] = await db.select({ id: payments.id }).from(payments)
    .where(and(eq(payments.bookingId, booking.id), eq(payments.status, "succeeded")));
  if (paid) throw Errors.conflict("This booking is already paid");

  const breakdown = booking.priceBreakdown as QuoteBreakdown;
  const charge = chargeForBooking(booking.paymentOption as PaymentOption, breakdown);
  const [vehicle] = await db.select({ name: vehicles.name }).from(vehicles).where(eq(vehicles.id, booking.vehicleId));

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    // Omit payment_method_types → dynamic payment methods (Stripe best practice).
    line_items: [{
      quantity: 1,
      price_data: {
        currency: charge.currency.toLowerCase(),
        unit_amount: charge.amountCents,
        product_data: {
          name: `${LABEL[charge.type]} — ${vehicle?.name ?? "Tex Cars rental"}`,
          description: `${booking.startDate} to ${booking.endDate}`,
        },
      },
    }],
    metadata: { bookingId: booking.id, paymentType: charge.type },
    success_url: `${origin}/book/confirmation?id=${booking.id}`,
    cancel_url: `${origin}/book?canceled=1`,
  });

  if (!session.url) throw Errors.badRequest("Could not start checkout");

  // Record (or refresh) the pending payment row keyed to this session.
  await db.insert(payments).values({
    bookingId: booking.id,
    stripeCheckoutSessionId: session.id,
    type: charge.type,
    amountCents: charge.amountCents,
    currency: charge.currency,
    status: "pending",
  });

  return { url: session.url };
}
