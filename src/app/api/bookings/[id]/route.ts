import { z } from "zod";
import { eq } from "drizzle-orm";
import { withRoute } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { parseParams } from "@/lib/http/validate";
import { Errors } from "@/lib/http/errors";
import { enforceRateLimit } from "@/lib/http/rate-limit";
import { getDb } from "@/lib/db/client";
import { bookings, vehicles } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ParamsSchema = z.object({ id: z.string().uuid() });

/** GET /api/bookings/[id] — public booking status (no PII). Powers the
 *  confirmation page polling. Licence/customer data is never exposed here. */
export const GET = withRoute(async (req, { params }) => {
  await enforceRateLimit(req, "global", "public");
  const { id } = parseParams(await params, ParamsSchema);
  const db = await getDb();
  const [booking] = await db.select({
    id: bookings.id, status: bookings.status, startAt: bookings.startAt,
    endAt: bookings.endAt, paymentOption: bookings.paymentOption, priceBreakdown: bookings.priceBreakdown,
    // Additive (Task 12): lets the confirmation page show "Payment received: $X"
    // without a second round trip. Still no PII.
    amountPaidCents: bookings.amountPaidCents,
    // Additive (Task 4, desk-mode-adoption): the redesigned confirmation page's
    // summary card names the class + car. Vehicle class/name is not PII (same
    // fact already shown in the authenticated /account view via
    // listCustomerBookings' identical join); a left join keeps the booking
    // status lookup resilient even if a vehicle row were ever missing.
    vehicleClass: vehicles.class, vehicleName: vehicles.name,
  }).from(bookings).leftJoin(vehicles, eq(bookings.vehicleId, vehicles.id)).where(eq(bookings.id, id));
  if (!booking) throw Errors.notFound("Booking not found");
  return json(booking, req);
});
