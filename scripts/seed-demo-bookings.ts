/**
 * seed-demo-bookings.ts — populate the ops board with lively demo rentals.
 *
 * Idempotent: it first removes any prior rows tagged `demo-seed-*` (via
 * idempotencyKey), then inserts a fresh spread of bookings across the current
 * window so the admin planning board looks alive for a walkthrough.
 *
 * Run:  node --import tsx --env-file-if-exists=.env.local scripts/seed-demo-bookings.ts
 * These are DEMO rows only — safe to run against the local .dev-db.
 */
import { getDb, closeDb } from "../src/lib/db/client";
import { vehicles, customers, bookings } from "../src/lib/db/schema";
import { getSettings } from "../src/lib/admin/settings";
import { quote } from "../src/lib/booking/quote";
import { ne, like, eq, and } from "drizzle-orm";

// Anchor to "today" so the rentals sit in the board's opening window.
const TODAY = new Date();
function iso(offsetDays: number): string {
  const d = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth(), TODAY.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// Tourist-flavoured demo customers (reused across bookings).
const DEMO_CUSTOMERS = [
  { email: "demo+lisa@tex-cars.local", name: "Lisa Meijer", phone: "+31 6 1234 5678" },
  { email: "demo+james@tex-cars.local", name: "James Carter", phone: "+1 305 555 0110" },
  { email: "demo+sofia@tex-cars.local", name: "Sofia Rodríguez", phone: "+58 412 555 22" },
  { email: "demo+koen@tex-cars.local", name: "Koen de Vries", phone: "+31 6 8765 4321" },
  { email: "demo+emma@tex-cars.local", name: "Emma Johnson", phone: "+1 646 555 0199" },
  { email: "demo+walkin@tex-cars.local", name: "Walk-in (desk)", phone: "" },
];

// (vehicleIndex, startOffset, endOffset, status, source, paymentOption, customerIndex)
type Row = [number, number, number, "confirmed" | "pending" | "completed", "online" | "manual", "reservation_fee" | "full_deposit" | "cash_deposit", number];
const PLAN: Row[] = [
  [0, -4, -1, "completed", "online", "reservation_fee", 0], // just finished (green)
  [1, -2, 3, "confirmed", "online", "reservation_fee", 1], // ongoing (blue)
  [2, 0, 5, "confirmed", "online", "full_deposit", 2],
  [3, 1, 4, "pending", "online", "reservation_fee", 3], // awaiting payment (amber)
  [4, 2, 9, "confirmed", "online", "reservation_fee", 4],
  [5, -1, 2, "confirmed", "manual", "cash_deposit", 5], // walk-in desk rental
  [6, 5, 12, "pending", "online", "reservation_fee", 0],
  [7, 3, 7, "confirmed", "online", "full_deposit", 1],
  [8, -6, -3, "completed", "online", "reservation_fee", 2], // last week (green)
  [9, 8, 15, "confirmed", "online", "reservation_fee", 3],
];

async function main() {
  const db = await getDb();
  const settings = await getSettings();

  const fleet = (await db.select().from(vehicles).where(ne(vehicles.status, "retired"))) as any[];
  if (fleet.length < PLAN.length) {
    throw new Error(`Need at least ${PLAN.length} active vehicles; found ${fleet.length}. Run 'npm run db:seed' first.`);
  }

  // 1) Clean any previous demo-seed bookings so this is safely re-runnable.
  const removed = await db.delete(bookings).where(like(bookings.idempotencyKey, "demo-seed-%")).returning({ id: bookings.id });
  console.log(`cleared ${removed.length} previous demo-seed bookings`);

  // 2) Upsert demo customers, keep their ids.
  const custIds: string[] = [];
  for (const c of DEMO_CUSTOMERS) {
    await db.insert(customers).values({ ...c, emailVerified: true }).onConflictDoNothing({ target: customers.email });
    const [row] = await db.select().from(customers).where(eq(customers.email, c.email));
    custIds.push((row as any).id);
  }

  // 3) Insert the planned rentals.
  let n = 0;
  for (let i = 0; i < PLAN.length; i++) {
    const [vi, so, eo, status, source, paymentOption, ci] = PLAN[i]!;
    const v = fleet[vi]!;
    const startDate = iso(so);
    const endDate = iso(eo);
    const days = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000);
    const bufferEndDate = iso(eo + settings.turnaroundBufferDays);
    const breakdown = quote({
      days,
      vehicle: { priceDayCents: v.priceDayCents, priceWeekCents: v.priceWeekCents, priceMonthCents: v.priceMonthCents, depositCents: v.depositCents },
      insurance: null,
      addOns: [],
      reservationFeeCents: settings.reservationFeeCents,
      currency: settings.currency,
    });
    await db.insert(bookings).values({
      vehicleId: v.id,
      customerId: custIds[ci]!,
      startDate,
      endDate,
      bufferEndDate,
      status,
      source,
      notes: source === "manual" ? "Walk-in rental (demo)" : null,
      priceBreakdown: breakdown,
      paymentOption,
      acceptedPolicyVersion: 0,
      acceptedAt: new Date(),
      idempotencyKey: `demo-seed-${i}`,
    });
    n++;
    console.log(`  ${v.plate} ${v.name} · ${startDate}→${endDate} · ${status}/${source}`);
  }

  console.log(`\nseeded ${n} demo rentals across ${PLAN.length} cars ✅`);
  await closeDb();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
