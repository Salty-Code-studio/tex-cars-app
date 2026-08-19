/**
 * Builds the internal approval ping from LIVE back-office data, so the manager
 * sees what the back office knows before tapping. The availability line counts
 * same-class ACTIVE vehicles free over the requested dates via checkAvailability
 * (src/lib/booking/classes.ts's countClassAvailability), the same predicate the
 * booking flow itself uses, never a second hand-rolled overlap query. Plain
 * text on purpose: it renders identically in Telegram (no parse_mode; see
 * telegram.ts) and email. No PII beyond renter name, email, and phone: never
 * license or date-of-birth data.
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { bookings, customers, vehicles } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/time/format";
import { siteConfig } from "@/lib/site-config";
import { getSettings } from "@/lib/admin/settings";
import { countClassAvailability } from "@/lib/booking/classes";
import type { QuoteBreakdown } from "@/lib/booking/quote";

export interface ApprovalMessage {
  text: string;
  vehicleName: string;
  startAt: string;
  endAt: string;
  customerName: string;
  totalLabel: string;
  fleetLine: string;
}

export async function buildApprovalMessage(bookingId: string): Promise<ApprovalMessage | null> {
  const db = await getDb();
  const [row] = await db.select({
    booking: bookings, vehicle: vehicles,
    customerName: customers.name, customerPhone: customers.phone, customerEmail: customers.email,
  }).from(bookings)
    .innerJoin(vehicles, eq(bookings.vehicleId, vehicles.id))
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .where(eq(bookings.id, bookingId));
  if (!row) return null;

  const b = row.booking;
  const breakdown = b.priceBreakdown as QuoteBreakdown;
  const currency = breakdown.currency ?? "USD";
  const totalLabel = formatMoney(breakdown.subtotalCents ?? 0, currency);
  const depositLabel = breakdown.depositCents != null ? formatMoney(breakdown.depositCents, currency) : null;

  const settings = await getSettings();
  const { free, total } = await countClassAvailability(
    row.vehicle.class, b.startAt, b.endAt, settings, bookingId,
  );
  const fleetLine = `${free} of ${total} ${row.vehicle.class} cars free for these dates`;

  // Name and email are always shown; phone only when the customer actually
  // gave one (the column defaults to "" rather than null).
  const renterLine = [row.customerName, row.customerEmail, row.customerPhone || null]
    .filter((v): v is string => Boolean(v && v.trim()))
    .join(" · ");

  const lines = [
    `New booking · ${siteConfig.siteName}`,
    renterLine,
    `${formatDateTime(b.startAt)} to ${formatDateTime(b.endAt)}`,
    `${row.vehicle.class} · ${row.vehicle.name} (${row.vehicle.plate})`,
    `Total ${totalLabel}${depositLabel ? ` · Deposit ${depositLabel}` : ""} · pay at pickup`,
    ...(breakdown.youngDriver ? ["Young driver surcharge applied"] : []),
    fleetLine,
  ];
  const text = lines.join("\n");

  return { text, vehicleName: row.vehicle.name, startAt: b.startAt, endAt: b.endAt, customerName: row.customerName, totalLabel, fleetLine };
}

function formatMoney(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}
