/**
 * Unpaid-hold expiry: a pending booking that never gets paid would tie up a car
 * forever (the exclusion constraint counts pending bookings). This cancels
 * pending holds older than the TTL that have no succeeded payment, freeing the
 * slot (cancelled bookings fall outside the constraint). The scheduled run is
 * Plan 07 ops; the function + an admin trigger live here.
 */
import { and, eq, lt, notExists } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { bookings, payments } from "@/lib/db/schema";

export async function expireStaleHolds(ttlMinutes: number, now = new Date()): Promise<number> {
  const db = await getDb();
  const cutoff = new Date(now.getTime() - ttlMinutes * 60_000);

  const cancelled = await db.update(bookings)
    .set({ status: "cancelled", updatedAt: now })
    .where(and(
      eq(bookings.status, "pending"),
      lt(bookings.createdAt, cutoff),
      // no succeeded payment for this booking
      notExists(
        db.select({ one: payments.id }).from(payments)
          .where(and(eq(payments.bookingId, bookings.id), eq(payments.status, "succeeded"))),
      ),
    ))
    .returning({ id: bookings.id });

  return cancelled.length;
}
