import { withRoute } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { read } from "@/lib/admin/guard";
import { getDb } from "@/lib/db/client";
import { adminUsers } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users — owner-only team list. The column list is an
 * explicit ALLOWLIST (not `select *`): passwordHash and totpSecretEnc must
 * never leave this endpoint.
 */
export const GET = withRoute(async (req) =>
  json(
    await read(req, async () => {
      const db = await getDb();
      const users = await db
        .select({
          id: adminUsers.id,
          email: adminUsers.email,
          role: adminUsers.role,
          mfaEnabled: adminUsers.mfaEnabled,
          createdAt: adminUsers.createdAt,
        })
        .from(adminUsers);
      return { users };
    }),
    req,
  ),
);
