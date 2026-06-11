import { pgTable, pgEnum, text, integer, timestamp, date, uuid, jsonb, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { vehicles } from "./fleet";
import { customers } from "./customers";
import { addOns, insuranceTiers } from "./catalog";

export const bookingStatus = pgEnum("booking_status", ["pending", "confirmed", "cancelled", "completed"]);
export const paymentOption = pgEnum("payment_option", ["reservation_fee", "full_deposit", "cash_deposit"]);

/**
 * Date semantics: [startDate, endDate) — endDate is the return day, exclusive,
 * so back-to-back rentals share a boundary day without colliding.
 *
 * Overlap safety is NOT app code: a custom migration adds
 *   EXCLUDE USING gist (vehicle_id WITH =, daterange(start_date, end_date, '[)') WITH &&)
 *   WHERE (status IN ('pending', 'confirmed'))
 * making double-booking physically impossible even under a race (spec §7).
 */
export const bookings = pgTable("bookings", {
  id: uuid("id").defaultRandom().primaryKey(),
  vehicleId: uuid("vehicle_id").notNull().references(() => vehicles.id),
  customerId: uuid("customer_id").notNull().references(() => customers.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: bookingStatus("status").notNull().default("pending"),
  priceBreakdown: jsonb("price_breakdown").notNull(), // server-computed snapshot, never client math
  insuranceTierId: uuid("insurance_tier_id").references(() => insuranceTiers.id),
  insuranceSnapshot: jsonb("insurance_snapshot"),
  paymentOption: paymentOption("payment_option").notNull(),
  acceptedPolicyVersion: integer("accepted_policy_version").notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("bookings_dates", sql`${t.endDate} > ${t.startDate}`)]);

export const bookingAddOns = pgTable("booking_add_ons", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  addOnId: uuid("add_on_id").notNull().references(() => addOns.id),
  qty: integer("qty").notNull().default(1),
  priceSnapshotCents: integer("price_snapshot_cents").notNull(),
}, (t) => [check("booking_add_ons_qty", sql`${t.qty} > 0`)]);
