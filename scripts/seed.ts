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
// row ID on the ops board. Prices are in Aruban florin CENTS (Afl. 1 = 100),
// deposit Afl. 500. Economy = Hyundai i10 / Ford Figo / Suzuki; Compact =
// Hyundai Accent / Chevrolet Aveo / Kia Rio. Owner edits any of this in Fleet.
const FLEET = [
  { slug: "ford-figo-a-21553", plate: "A-21553", class: "Economy", name: "Ford Figo · White · 2020", seats: 5, transmission: "Automatic", ac: true, doors: 5, priceDayCents: 5500, priceWeekCents: 33000, priceMonthCents: 130000, depositCents: 50000 },
  { slug: "ford-figo-a-26686", plate: "A-26686", class: "Economy", name: "Ford Figo · Silver · 2020", seats: 5, transmission: "Automatic", ac: true, doors: 5, priceDayCents: 5500, priceWeekCents: 33000, priceMonthCents: 130000, depositCents: 50000 },
  { slug: "ford-figo-a-48017", plate: "A-48017", class: "Economy", name: "Ford Figo · Gold · 2020", seats: 5, transmission: "Automatic", ac: true, doors: 5, priceDayCents: 5500, priceWeekCents: 33000, priceMonthCents: 130000, depositCents: 50000 },
  { slug: "ford-figo-a-27634", plate: "A-27634", class: "Economy", name: "Ford Figo · Silver · 2020", seats: 5, transmission: "Automatic", ac: true, doors: 5, priceDayCents: 5500, priceWeekCents: 33000, priceMonthCents: 130000, depositCents: 50000 },
  { slug: "ford-figo-a-74195", plate: "A-74195", class: "Economy", name: "Ford Figo · Gold · 2020", seats: 5, transmission: "Automatic", ac: true, doors: 5, priceDayCents: 5500, priceWeekCents: 33000, priceMonthCents: 130000, depositCents: 50000 },
  { slug: "ford-figo-a-74325", plate: "A-74325", class: "Economy", name: "Ford Figo · Gold · 2020", seats: 5, transmission: "Automatic", ac: true, doors: 5, priceDayCents: 5500, priceWeekCents: 33000, priceMonthCents: 130000, depositCents: 50000 },
  { slug: "hyundai-accent-a-11235", plate: "A-11235", class: "Compact", name: "Hyundai Accent · White · 2020", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 6000, priceWeekCents: 35000, priceMonthCents: 130000, depositCents: 50000 },
  { slug: "hyundai-accent-a-53429", plate: "A-53429", class: "Compact", name: "Hyundai Accent · Grey · 2019", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 6000, priceWeekCents: 35000, priceMonthCents: 130000, depositCents: 50000 },
  { slug: "hyundai-accent-a-31843", plate: "A-31843", class: "Compact", name: "Hyundai Accent · White · 2017", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 6000, priceWeekCents: 35000, priceMonthCents: 130000, depositCents: 50000 },
  { slug: "hyundai-accent-a-39087", plate: "A-39087", class: "Compact", name: "Hyundai Accent · White · 2016", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 6000, priceWeekCents: 35000, priceMonthCents: 130000, depositCents: 50000 },
  { slug: "hyundai-accent-a-61302", plate: "A-61302", class: "Compact", name: "Hyundai Accent · Red · 2017", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 6000, priceWeekCents: 35000, priceMonthCents: 130000, depositCents: 50000 },
  { slug: "hyundai-accent-a-51002", plate: "A-51002", class: "Compact", name: "Hyundai Accent · Black · 2015", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 6000, priceWeekCents: 35000, priceMonthCents: 130000, depositCents: 50000 },
  { slug: "hyundai-i10-a-36142", plate: "A-36142", class: "Economy", name: "Hyundai i10 · Red · 2017", seats: 4, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 5000, priceWeekCents: 30000, priceMonthCents: 115000, depositCents: 50000 },
  { slug: "hyundai-i10-a-74641", plate: "A-74641", class: "Economy", name: "Hyundai i10 · Black · 2017", seats: 4, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 5000, priceWeekCents: 30000, priceMonthCents: 115000, depositCents: 50000 },
  { slug: "hyundai-i10-a-72866", plate: "A-72866", class: "Economy", name: "Hyundai i10 · Silver · 2017", seats: 4, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 5000, priceWeekCents: 30000, priceMonthCents: 115000, depositCents: 50000 },
  { slug: "hyundai-i10-a-63574", plate: "A-63574", class: "Economy", name: "Hyundai i10 · Red · 2016", seats: 4, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 5000, priceWeekCents: 30000, priceMonthCents: 115000, depositCents: 50000 },
  { slug: "hyundai-i10-a-35201", plate: "A-35201", class: "Economy", name: "Hyundai i10 · Silver · 2013", seats: 4, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 5000, priceWeekCents: 30000, priceMonthCents: 115000, depositCents: 50000 },
  { slug: "hyundai-i10-a-16107", plate: "A-16107", class: "Economy", name: "Hyundai i10 · Silver · 2013", seats: 4, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 5000, priceWeekCents: 30000, priceMonthCents: 115000, depositCents: 50000 },
  { slug: "hyundai-i10-a-58705", plate: "A-58705", class: "Economy", name: "Hyundai i10 · Silver · 2013", seats: 4, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 5000, priceWeekCents: 30000, priceMonthCents: 115000, depositCents: 50000 },
  { slug: "chevrolet-aveo-a-81857", plate: "A-81857", class: "Compact", name: "Chevrolet Aveo · Grey · 2016", seats: 5, transmission: "Automatic", ac: false, doors: 4, priceDayCents: 5500, priceWeekCents: 33000, priceMonthCents: 120000, depositCents: 50000 },
  { slug: "chevrolet-aveo-a-70077", plate: "A-70077", class: "Compact", name: "Chevrolet Aveo · Red · 2014", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 5500, priceWeekCents: 33000, priceMonthCents: 120000, depositCents: 50000 },
  { slug: "hyundai-i10-a-67699", plate: "A-67699", class: "Economy", name: "Hyundai i10 · Silver · 2016", seats: 4, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 5000, priceWeekCents: 30000, priceMonthCents: 115000, depositCents: 50000 },
  { slug: "kia-rio-a-26780", plate: "A-26780", class: "Compact", name: "Kia Rio · Grey · 2013", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 5500, priceWeekCents: 33000, priceMonthCents: 120000, depositCents: 50000 },
  { slug: "kia-rio-a-71831", plate: "A-71831", class: "Compact", name: "Kia Rio · Red · 2013", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 5500, priceWeekCents: 33000, priceMonthCents: 120000, depositCents: 50000 },
  { slug: "suzuki-station-a-48761", plate: "A-48761", class: "Economy", name: "Suzuki Station · Grey · 2001", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 4000, priceWeekCents: 24000, priceMonthCents: 90000, depositCents: 50000 },
  { slug: "suzuki-baleno-a-74640", plate: "A-74640", class: "Economy", name: "Suzuki Baleno · Green · 2000", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 4000, priceWeekCents: 24000, priceMonthCents: 90000, depositCents: 50000 },
  { slug: "suzuki-baleno-a-71830", plate: "A-71830", class: "Economy", name: "Suzuki Baleno · Silver · 1999", seats: 5, transmission: "Automatic", ac: false, doors: 4, priceDayCents: 4000, priceWeekCents: 24000, priceMonthCents: 90000, depositCents: 50000 },
  { slug: "suzuki-baleno-a-50197", plate: "A-50197", class: "Economy", name: "Suzuki Baleno · Red · 1999", seats: 5, transmission: "Automatic", ac: false, doors: 4, priceDayCents: 4000, priceWeekCents: 24000, priceMonthCents: 90000, depositCents: 50000 },
  { slug: "suzuki-station-a-65968", plate: "A-65968", class: "Economy", name: "Suzuki Station · Green · 1999", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 4000, priceWeekCents: 24000, priceMonthCents: 90000, depositCents: 50000 },
  { slug: "suzuki-baleno-a-47768", plate: "A-47768", class: "Economy", name: "Suzuki Baleno · Green · 1998", seats: 5, transmission: "Automatic", ac: false, doors: 4, priceDayCents: 4000, priceWeekCents: 24000, priceMonthCents: 90000, depositCents: 50000 },
  { slug: "suzuki-station-a-67530", plate: "A-67530", class: "Economy", name: "Suzuki Station · Dark blue · 1999", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 4000, priceWeekCents: 24000, priceMonthCents: 90000, depositCents: 50000 },
  { slug: "suzuki-baleno-a-21141", plate: "A-21141", class: "Economy", name: "Suzuki Baleno · White · 1999", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 4000, priceWeekCents: 24000, priceMonthCents: 90000, depositCents: 50000 },
  { slug: "suzuki-baleno-a-68405", plate: "A-68405", class: "Economy", name: "Suzuki Baleno · Silver · 1997", seats: 5, transmission: "Automatic", ac: false, doors: 4, priceDayCents: 4000, priceWeekCents: 24000, priceMonthCents: 90000, depositCents: 50000 },
  { slug: "suzuki-baleno-a-71203", plate: "A-71203", class: "Economy", name: "Suzuki Baleno · Black · 2001", seats: 5, transmission: "Automatic", ac: true, doors: 4, priceDayCents: 4000, priceWeekCents: 24000, priceMonthCents: 90000, depositCents: 50000 },
];

async function seed() {
  await runMigrations();
  const db = await getDb();

  await db.insert(settings).values({ id: 1, currency: "AWG" }).onConflictDoNothing();

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
