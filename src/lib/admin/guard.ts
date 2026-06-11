/**
 * Uniform admin route plumbing so every resource enforces the same controls.
 *
 *   read(req, fn)            — GET: requireAdmin, then fn. Safe method, no CSRF.
 *   mutate(req, action, fn)  — POST/PATCH/DELETE: requireAdmin (which enforces
 *                              CSRF on unsafe methods), run fn, then audit-log
 *                              `action` with whatever {before, after, entityId}
 *                              fn returns. The audit write never blocks success.
 */
import { requireAdmin, type AdminContext, type RequireAdminOptions } from "@/lib/auth/admin-auth";
import { audit } from "@/lib/audit";

export async function read<T>(
  req: Request,
  fn: (ctx: AdminContext) => Promise<T>,
  opts?: RequireAdminOptions,
): Promise<T> {
  const ctx = await requireAdmin(req, opts);
  return fn(ctx);
}

export interface MutationOutcome<T> {
  result: T;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}

export async function mutate<T>(
  req: Request,
  action: string,
  fn: (ctx: AdminContext) => Promise<MutationOutcome<T>>,
): Promise<T> {
  const ctx = await requireAdmin(req);
  const outcome = await fn(ctx);
  await audit({
    actor: ctx.admin.id,
    action,
    entity: outcome.entity,
    entityId: outcome.entityId,
    before: outcome.before,
    after: outcome.after,
    req,
  });
  return outcome.result;
}
