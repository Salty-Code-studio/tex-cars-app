/**
 * Idempotent database seed — settings singleton, placeholder insurance tiers,
 * placeholder add-ons, and the six Phase 1 vehicles (mirrors site/data/fleet.js,
 * dollars → cents). Safe to run repeatedly: every insert is onConflictDoNothing
 * keyed on natural uniques. Replace placeholder prices/cars when the owner
 * confirms the real fleet (spec §16).
 *
 * Run: npm run db:seed   (applies pending migrations first)
 */
import { runMigrations } from "../src/lib/db/migrate";
import { getDb, closeDb } from "../src/lib/db/client";
import { settings, vehicles, insuranceTiers, addOns } from "../src/lib/db/schema";

const FLEET = [
  { slug: "kia-picanto", plate: "A-0001",    class: "Economy", name: "Kia Picanto",    seats: 4, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 72000 },
  { slug: "hyundai-accent", plate: "A-0002", class: "Compact", name: "Hyundai Accent", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 4200, priceWeekCents: 25200, priceMonthCents: 85000 },
  { slug: "hyundai-creta", plate: "A-0003",  class: "SUV",     name: "Hyundai Creta",  seats: 5, transmission: "Automatic", ac: true, doors: 5, priceDayCents: 5800, priceWeekCents: 34800, priceMonthCents: 118000 },
  { slug: "kia-sportage", plate: "A-0004",   class: "SUV",     name: "Kia Sportage",   seats: 5, transmission: "Automatic", ac: true, doors: 5, priceDayCents: 6500, priceWeekCents: 39000, priceMonthCents: 132000 },
  { slug: "suzuki-jimny", plate: "A-0005",   class: "4x4",     name: "Suzuki Jimny",   seats: 4, transmission: "Manual",    ac: true, doors: 3, priceDayCents: 7000, priceWeekCents: 42000, priceMonthCents: 145000 },
  { slug: "hyundai-staria", plate: "A-0006", class: "Van",     name: "Hyundai Staria", seats: 8, transmission: "Automatic", ac: true, doors: 5, priceDayCents: 9500, priceWeekCents: 57000, priceMonthCents: 195000 },
];

async function seed() {
  await runMigrations();
  const db = await getDb();

  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();

  await db.insert(vehicles).values(FLEET).onConflictDoNothing({ target: vehicles.slug });

  // Placeholder tiers/add-ons (spec §16: final list + prices from owner; all editable in the dashboard)
  const existingTiers = await db.select({ id: insuranceTiers.id }).from(insuranceTiers);
  if (existingTiers.length === 0) {
    await db.insert(insuranceTiers).values([
      { name: "Basic", dailyPriceCents: 0, coverage: "Included with every rental.", isDefault: true },
      { name: "Standard", dailyPriceCents: 800, coverage: "Lower excess, tire and glass cover." },
      { name: "Premium", dailyPriceCents: 1500, coverage: "Zero excess, full peace of mind." },
    ]);
  }

  const existingAddOns = await db.select({ id: addOns.id }).from(addOns);
  if (existingAddOns.length === 0) {
    await db.insert(addOns).values([
      { name: "Baby chair", priceCents: 500, pricing: "per_day", category: "family", stock: 3 },
      { name: "Cooler", priceCents: 700, pricing: "per_rental", category: "beach", stock: 5 },
      { name: "Snorkel set", priceCents: 1000, pricing: "per_rental", category: "beach", stock: 6 },
      { name: "Extra driver", priceCents: 1500, pricing: "per_rental", category: "driving", stock: null },
    ]);
  }

  console.log("Seed complete: settings, 6 vehicles, 3 insurance tiers, 4 add-ons (placeholders flagged in spec §16).");
}

seed()
  .then(async () => { await closeDb(); process.exit(0); })
  .catch(async (e) => { console.error(e); await closeDb().catch(() => undefined); process.exit(1); });
