import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { bookings, vehicles } from "@/lib/db/schema";
import { Errors } from "@/lib/http/errors";
import { translateDbError } from "@/lib/db/errors";
import { getSettings } from "@/lib/admin/settings";
import { isoDate } from "@/lib/validation/iso-date";

/**
 * Drag-to-move on the ops board. Any subset of {vehicleId, startDate, endDate}
 * may change. The recomputed range is re-validated by the same physical
 * exclusion constraint that guards creation, so a move into an occupied slot
 * (on the same or a different car) is rejected at the database level. Soft
 * guardrails (lead time, length) are skipped — the desk owns these decisions.
 */
export const MoveSchema = z.object({
  vehicleId: z.string().uuid().optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
}).strict();
export type MoveInput = z.infer<typeof MoveSchema>;

export async function moveBooking(id: string, input: MoveInput) {
  const db = await getDb();
  const settings = await getSettings();
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
  if (!booking) throw Errors.notFound("Booking not found");
  if (booking.status !== "pending" && booking.status !== "confirmed") {
    throw Errors.conflict("This booking can no longer be moved");
  }

  const vehicleId = input.vehicleId ?? booking.vehicleId;
  const startDate = input.startDate ?? booking.startDate;
  const endDate = input.endDate ?? booking.endDate;
  if (endDate <= startDate) throw Errors.badRequest("Return must be after pick-up");

  if (input.vehicleId) {
    const [v] = await db.select({ status: vehicles.status }).from(vehicles).where(eq(vehicles.id, input.vehicleId));
    if (!v || v.status === "retired") throw Errors.notFound("Target vehicle not available");
  }

  const bufferEndDate = new Date(Date.parse(`${endDate}T00:00:00Z`) + settings.turnaroundBufferDays * 86_400_000)
    .toISOString().slice(0, 10);

  try {
    const [updated] = await db.update(bookings)
      .set({ vehicleId, startDate, endDate, bufferEndDate, updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();
    return updated!;
  } catch (e) {
    const t = translateDbError(e); // 23P01 overlap+buffer → 409
    if (t) throw t;
    throw e;
  }
}

/**
 * Admin cancel from the board. Frees the slot immediately: the exclusion
 * constraint only spans pending/confirmed rows, so flipping to cancelled lets a
 * new booking reuse the range. Terminal states (cancelled/completed) are inert.
 */
export async function cancelBookingAdmin(id: string) {
  const db = await getDb();
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
  if (!booking) throw Errors.notFound("Booking not found");
  if (booking.status === "cancelled" || booking.status === "completed") {
    throw Errors.conflict("This booking can no longer be cancelled");
  }
  const [updated] = await db.update(bookings)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(bookings.id, id))
    .returning();
  return updated!;
}
