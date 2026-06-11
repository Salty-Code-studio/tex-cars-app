/**
 * Append-only audit trail (spec §5: every admin action logged). Inserts must
 * never break the calling flow: failures are logged, not thrown.
 */
import { getDb } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";
import { logger } from "@/lib/logger";

export interface AuditEntry {
  actor: string; // admin user id, customer id, or "anonymous"/"system"
  action: string; // dotted verb, e.g. "admin.login_failed"
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  req?: Request;
}

function clientIp(req: Request | undefined): string | null {
  if (!req) return null;
  // Behind Vercel/our proxy these are overwritten by the platform edge.
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? null;
}

export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(auditLog).values({
      actor: entry.actor,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      ip: clientIp(entry.req),
      ua: entry.req?.headers.get("user-agent") ?? null,
    });
  } catch (error) {
    logger.error("audit_write_failed", { action: entry.action, error: (error as Error).message });
  }
}
