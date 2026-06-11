import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { settings, blackoutDates } from "@/lib/db/schema";
import { centsField } from "@/lib/admin/money";

export type Settings = typeof settings.$inferSelect;
export type BlackoutDate = typeof blackoutDates.$inferSelect;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

/** Partial update — every field optional, each independently range-checked. */
export const SettingsPatchSchema = z.object({
  reservationFeeCents: centsField.optional(),
  currency: z.string().trim().toUpperCase().length(3, "3-letter currency code").optional(),
  minDriverAge: z.number().int().min(16).max(99).optional(),
  turnaroundBufferDays: z.number().int().min(0).max(30).optional(),
  minRentalDays: z.number().int().min(1).max(365).optional(),
  maxRentalDays: z.number().int().min(1).max(365).optional(),
  maxAdvanceDays: z.number().int().min(1).max(1095).optional(),
  adminAlertRecipients: z.array(z.string().trim().toLowerCase().email()).max(20).optional(),
}).strict().refine(
  (v) => v.minRentalDays === undefined || v.maxRentalDays === undefined || v.minRentalDays <= v.maxRentalDays,
  { message: "minRentalDays must be ≤ maxRentalDays", path: ["minRentalDays"] },
);

export const BlackoutSchema = z.object({
  startDate: isoDate,
  endDate: isoDate,
  reason: z.string().trim().max(200).default(""),
}).strict().refine((v) => v.endDate > v.startDate, {
  message: "endDate must be after startDate", path: ["endDate"],
});

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  if (row) return row;
  // Self-heal if the seed never ran: create the singleton with defaults.
  const [created] = await db.insert(settings).values({ id: 1 }).onConflictDoNothing().returning();
  if (created) return created;
  const [existing] = await db.select().from(settings).where(eq(settings.id, 1));
  return existing!;
}

export async function patchSettings(patch: z.infer<typeof SettingsPatchSchema>): Promise<Settings> {
  const db = await getDb();
  await getSettings(); // ensure the row exists
  const [updated] = await db.update(settings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(settings.id, 1))
    .returning();
  return updated!;
}

export async function listBlackouts(): Promise<BlackoutDate[]> {
  const db = await getDb();
  return db.select().from(blackoutDates).orderBy(blackoutDates.startDate);
}

export async function createBlackout(input: z.infer<typeof BlackoutSchema>): Promise<BlackoutDate> {
  const db = await getDb();
  const [row] = await db.insert(blackoutDates).values(input).returning();
  return row!;
}

export async function deleteBlackout(id: string): Promise<boolean> {
  const db = await getDb();
  const deleted = await db.delete(blackoutDates).where(eq(blackoutDates.id, id)).returning({ id: blackoutDates.id });
  return deleted.length > 0;
}
