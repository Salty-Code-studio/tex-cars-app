import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { policies } from "@/lib/db/schema";

export type Policy = typeof policies.$inferSelect;
export type PolicyType = "rental_terms" | "cancellation" | "privacy";

export const PolicyPublishSchema = z.object({
  type: z.enum(["rental_terms", "cancellation", "privacy"]),
  body: z.string().trim().min(1, "policy body is required").max(50_000),
}).strict();

/**
 * Publish a NEW version of a policy. We never UPDATE an existing row — each
 * publish is a new immutable version (spec §10: older versions kept for proof,
 * bookings reference the version they accepted).
 */
export async function publishPolicy(input: z.infer<typeof PolicyPublishSchema>): Promise<Policy> {
  const db = await getDb();
  const rows = await db
    .select({ max: sql<number>`coalesce(max(${policies.version}), 0)` })
    .from(policies)
    .where(eq(policies.type, input.type));
  const nextVersion = Number(rows[0]?.max ?? 0) + 1;
  const [row] = await db.insert(policies).values({
    type: input.type,
    version: nextVersion,
    body: input.body,
    publishedAt: new Date(),
  }).returning();
  return row!;
}

export async function getLatestPolicy(type: PolicyType): Promise<Policy | undefined> {
  const db = await getDb();
  const [row] = await db.select().from(policies)
    .where(eq(policies.type, type))
    .orderBy(desc(policies.version))
    .limit(1);
  return row;
}

export interface PolicyOverview {
  type: PolicyType;
  latest: Policy | null;
  versionCount: number;
}

export async function policyOverview(): Promise<PolicyOverview[]> {
  const db = await getDb();
  const types: PolicyType[] = ["rental_terms", "cancellation", "privacy"];
  return Promise.all(types.map(async (type) => {
    const latest = await getLatestPolicy(type);
    const counts = await db.select({ n: sql<number>`count(*)` }).from(policies).where(eq(policies.type, type));
    return { type, latest: latest ?? null, versionCount: Number(counts[0]?.n ?? 0) };
  }));
}

export async function getPolicyVersion(type: PolicyType, version: number): Promise<Policy | undefined> {
  const db = await getDb();
  const [row] = await db.select().from(policies)
    .where(and(eq(policies.type, type), eq(policies.version, version)));
  return row;
}
