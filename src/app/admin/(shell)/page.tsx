import { count, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { vehicles, bookings, addOns, insuranceTiers } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const db = await getDb();
  const [[v], [b], [a], [i]] = await Promise.all([
    db.select({ n: count() }).from(vehicles).where(eq(vehicles.status, "active")),
    db.select({ n: count() }).from(bookings),
    db.select({ n: count() }).from(addOns).where(eq(addOns.active, true)),
    db.select({ n: count() }).from(insuranceTiers).where(eq(insuranceTiers.active, true)),
  ]);

  return (
    <>
      <h1>Dashboard</h1>
      <p className="sub">The operations hub. Fleet, pricing, and bookings management land in Plans 03 and 04.</p>
      <div className="cards">
        <div className="card"><div className="n">{v?.n ?? 0}</div><div className="t">Active vehicles</div></div>
        <div className="card"><div className="n">{b?.n ?? 0}</div><div className="t">Bookings</div></div>
        <div className="card"><div className="n">{a?.n ?? 0}</div><div className="t">Add-ons</div></div>
        <div className="card"><div className="n">{i?.n ?? 0}</div><div className="t">Insurance tiers</div></div>
      </div>
    </>
  );
}
