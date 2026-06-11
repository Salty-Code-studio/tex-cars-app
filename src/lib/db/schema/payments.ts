import { pgTable, pgEnum, text, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { bookings } from "./bookings";

export const paymentType = pgEnum("payment_type", ["reservation_fee", "deposit"]);
export const paymentStatus = pgEnum("payment_status", ["pending", "succeeded", "failed", "refunded"]);

/** One row per Stripe charge attempt. Amounts are snapshots computed
 *  server-side; status flips on the SIGNED webhook only (spec §3). */
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id),
  stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
  type: paymentType("type").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: paymentStatus("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Idempotency store for inbound Stripe webhooks: a redelivered event id is a
 *  no-op, so processing happens exactly once (fort webhook-signing-replay). */
export const stripeWebhookEvents = pgTable("stripe_webhook_events", {
  eventId: text("event_id").primaryKey(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
