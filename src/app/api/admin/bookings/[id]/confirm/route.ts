import { z } from "zod";
import { withRoute } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { parseParams } from "@/lib/http/validate";
import { mutate } from "@/lib/admin/guard";
import { confirmBookingAdmin } from "@/lib/admin/move-booking";
import { notifyReservationConfirmed } from "@/lib/email/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ParamsSchema = z.object({ id: z.string().uuid() });

export const POST = withRoute(async (req, { params }) => {
  const { id } = parseParams(await params, ParamsSchema);
  const updated = await mutate(req, "admin.booking_confirmed", async () => {
    const row = await confirmBookingAdmin(id);
    return { result: row, entity: "booking", entityId: id, after: { status: row.status } };
  });
  await notifyReservationConfirmed(updated.id); // best-effort; never throws (see notifications.ts)
  return json({ id: updated.id, status: updated.status }, req);
});
