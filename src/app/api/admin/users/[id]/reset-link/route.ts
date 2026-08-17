import { z } from "zod";
import { withRoute } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { parseParams } from "@/lib/http/validate";
import { mutate } from "@/lib/admin/guard";
import { mintResetLink } from "@/lib/auth/admin-reset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ParamsSchema = z.object({ id: z.string().uuid() });

/**
 * POST /api/admin/users/[id]/reset-link — owner mints a one-time reset link
 * to hand to a team member out-of-band (e.g. WhatsApp). The link is returned
 * ONCE here and never stored raw; `mutate` audit-logs who minted for whom.
 */
export const POST = withRoute(async (req, { params }) => {
  const { id } = parseParams(await params, ParamsSchema);
  const minted = await mutate(req, "admin.password_reset_link_minted", async () => {
    const url = await mintResetLink(id);
    return { result: { url }, entity: "admin_user", entityId: id };
  });
  return json(minted, req);
});
