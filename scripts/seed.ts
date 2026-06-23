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

// Real fleet from the owner's "UITLEEN 2025" sheet (Jun 2026). Plate is the
// row ID on the ops board and is the Aruba RENTAL plate (V-series, "verhuur").
// The sheet lists two plates per car: a private A-plate and the rental V-plate;
// we use the V-plate. Prices are flat per-class USD cents (Economy $35/day,
// Compact $40/day), deposit $250. Customers book a TYPE; any car of that class
// costs the same. Economy = Hyundai i10 / Ford Figo / Suzuki; Compact =
// Hyundai Accent / Chevrolet Aveo / Kia Rio. Owner edits any of this in Fleet.
//
// ⚠️ The last 4 cars (oldest Suzukis) have NO V-plate listed in the sheet, so
// they keep their A-plate as a placeholder. Get the real V-plates from the owner
// and replace them (or retire those cars if they are no longer rented).
const FLEET = [
  { slug: "ford-figo-v-7111", plate: "V-7111", class: "Economy", name: "Ford Figo · White · 2020", seats: 5, transmission: "Automatic", ac: true, doors: 5, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "ford-figo-v-7112", plate: "V-7112", class: "Economy", name: "Ford Figo · Silver · 2020", seats: 5, transmission: "Automatic", ac: true, doors: 5, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "ford-figo-v-7113", plate: "V-7113", class: "Economy", name: "Ford Figo · Gold · 2020", seats: 5, transmission: "Automatic", ac: true, doors: 5, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "ford-figo-v-7114", plate: "V-7114", class: "Economy", name: "Ford Figo · Silver · 2020", seats: 5, transmission: "Automatic", ac: true, doors: 5, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "ford-figo-v-7115", plate: "V-7115", class: "Economy", name: "Ford Figo · Gold · 2020", seats: 5, transmission: "Automatic", ac: true, doors: 5, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "ford-figo-v-7116", plate: "V-7116", class: "Economy", name: "Ford Figo · Gold · 2020", seats: 5, transmission: "Automatic", ac: true, doors: 5, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "hyundai-accent-v-7117", plate: "V-7117", class: "Compact", name: "Hyundai Accent · White · 2020", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 4000, priceWeekCents: 24000, priceMonthCents: 80000, depositCents: 25000 },
  { slug: "hyundai-accent-v-7118", plate: "V-7118", class: "Compact", name: "Hyundai Accent · Grey · 2019", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 4000, priceWeekCents: 24000, priceMonthCents: 80000, depositCents: 25000 },
  { slug: "hyundai-accent-v-7119", plate: "V-7119", class: "Compact", name: "Hyundai Accent · White · 2017", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 4000, priceWeekCents: 24000, priceMonthCents: 80000, depositCents: 25000 },
  { slug: "hyundai-accent-v-7120", plate: "V-7120", class: "Compact", name: "Hyundai Accent · White · 2016", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 4000, priceWeekCents: 24000, priceMonthCents: 80000, depositCents: 25000 },
  { slug: "hyundai-accent-v-7121", plate: "V-7121", class: "Compact", name: "Hyundai Accent · Red · 2017", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 4000, priceWeekCents: 24000, priceMonthCents: 80000, depositCents: 25000 },
  { slug: "hyundai-accent-v-7122", plate: "V-7122", class: "Compact", name: "Hyundai Accent · Black · 2015", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 4000, priceWeekCents: 24000, priceMonthCents: 80000, depositCents: 25000 },
  { slug: "hyundai-i10-v-7123", plate: "V-7123", class: "Economy", name: "Hyundai i10 · Red · 2017", seats: 4, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "hyundai-i10-v-7124", plate: "V-7124", class: "Economy", name: "Hyundai i10 · Black · 2017", seats: 4, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "hyundai-i10-v-7125", plate: "V-7125", class: "Economy", name: "Hyundai i10 · Silver · 2017", seats: 4, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "hyundai-i10-v-7126", plate: "V-7126", class: "Economy", name: "Hyundai i10 · Red · 2016", seats: 4, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "hyundai-i10-v-7127", plate: "V-7127", class: "Economy", name: "Hyundai i10 · Silver · 2013", seats: 4, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "hyundai-i10-v-7128", plate: "V-7128", class: "Economy", name: "Hyundai i10 · Silver · 2013", seats: 4, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "hyundai-i10-v-7129", plate: "V-7129", class: "Economy", name: "Hyundai i10 · Silver · 2013", seats: 4, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "chevrolet-aveo-v-7130", plate: "V-7130", class: "Compact", name: "Chevrolet Aveo · Grey · 2016", seats: 5, transmission: "Automatic", ac: false, doors: 4, priceDayCents: 4000, priceWeekCents: 24000, priceMonthCents: 80000, depositCents: 25000 },
  { slug: "chevrolet-aveo-v-7131", plate: "V-7131", class: "Compact", name: "Chevrolet Aveo · Red · 2014", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 4000, priceWeekCents: 24000, priceMonthCents: 80000, depositCents: 25000 },
  { slug: "hyundai-i10-v-7132", plate: "V-7132", class: "Economy", name: "Hyundai i10 · Silver · 2016", seats: 4, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "kia-rio-v-7133", plate: "V-7133", class: "Compact", name: "Kia Rio · Grey · 2013", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 4000, priceWeekCents: 24000, priceMonthCents: 80000, depositCents: 25000 },
  { slug: "kia-rio-v-7134", plate: "V-7134", class: "Compact", name: "Kia Rio · Red · 2013", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 4000, priceWeekCents: 24000, priceMonthCents: 80000, depositCents: 25000 },
  { slug: "suzuki-station-v-7135", plate: "V-7135", class: "Economy", name: "Suzuki Station · Grey · 2001", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "suzuki-baleno-v-7136", plate: "V-7136", class: "Economy", name: "Suzuki Baleno · Green · 2000", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "suzuki-baleno-v-7138", plate: "V-7138", class: "Economy", name: "Suzuki Baleno · Silver · 1999", seats: 5, transmission: "Automatic", ac: false, doors: 4, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "suzuki-baleno-v-7137", plate: "V-7137", class: "Economy", name: "Suzuki Baleno · Red · 1999", seats: 5, transmission: "Automatic", ac: false, doors: 4, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "suzuki-station-v-7139", plate: "V-7139", class: "Economy", name: "Suzuki Station · Green · 1999", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "suzuki-baleno-v-7140", plate: "V-7140", class: "Economy", name: "Suzuki Baleno · Green · 1998", seats: 5, transmission: "Automatic", ac: false, doors: 4, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "suzuki-station-a-67530", plate: "A-67530", class: "Economy", name: "Suzuki Station · Dark blue · 1999", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "suzuki-baleno-a-21141", plate: "A-21141", class: "Economy", name: "Suzuki Baleno · White · 1999", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "suzuki-baleno-a-68405", plate: "A-68405", class: "Economy", name: "Suzuki Baleno · Silver · 1997", seats: 5, transmission: "Automatic", ac: false, doors: 4, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
  { slug: "suzuki-baleno-a-71203", plate: "A-71203", class: "Economy", name: "Suzuki Baleno · Black · 2001", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 3500, priceWeekCents: 21000, priceMonthCents: 70000, depositCents: 25000 },
];

async function seed() {
  await runMigrations();
  const db = await getDb();

  await db.insert(settings).values({ id: 1, currency: "USD" }).onConflictDoNothing();

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
