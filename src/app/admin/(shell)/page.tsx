"use client";

import { useEffect, useMemo, useState } from "react";

interface Bar { id: string; start: string; end: string; status: string; label: string }
interface Vehicle { id: string; name: string; slug: string; class: string; bookings: Bar[]; blocks: { id: string; start: string; end: string; reason: string }[] }
interface Category { class: string; vehicles: Vehicle[] }
interface Planning {
  from: string; to: string; days: string[];
  categories: Category[];
  blackouts: { id: string; start: string; end: string; reason: string }[];
}

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const dayIdx = (from: string, d: string) => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const isWeekend = (d: string) => { const g = new Date(`${d}T00:00:00Z`).getUTCDay(); return g === 0 || g === 6; };
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export default function AdminDashboard() {
  const [data, setData] = useState<Planning | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const today = useMemo(() => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Aruba" }).format(new Date()), []);

  async function load(f?: string, t?: string) {
    setLoading(true);
    const qs = f && t ? `?from=${f}&to=${t}` : "";
    const d: Planning = await fetch(`/api/admin/planning${qs}`).then((r) => r.json());
    setData(d); setFrom(d.from); setTo(d.to); setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  const N = data?.days.length ?? 0;
  const span = (start: string, end: string) => {
    if (!data) return null;
    const s = Math.max(0, dayIdx(data.from, start));
    const e = Math.min(N, dayIdx(data.from, end)); // end exclusive
    if (e <= s) return null;
    return { left: `${(s / N) * 100}%`, width: `${((e - s) / N) * 100}%` };
  };

  const stats = useMemo(() => {
    if (!data) return { vehicles: 0, bookings: 0, confirmed: 0, pending: 0 };
    let vehicles = 0, bookings = 0, confirmed = 0, pending = 0;
    for (const c of data.categories) for (const v of c.vehicles) {
      vehicles++;
      for (const b of v.bookings) { bookings++; if (b.status === "confirmed") confirmed++; if (b.status === "pending") pending++; }
    }
    return { vehicles, bookings, confirmed, pending };
  }, [data]);

  return (
    <>
      <h1>Planning board</h1>
      <p className="sub">Your fleet across time. Each bar is a booking; drag the dates to move the window.</p>

      <div className="stat-strip">
        <div className="s"><b>{stats.vehicles}</b><span>active vehicles</span></div>
        <div className="s"><b>{stats.bookings}</b><span>bookings in view</span></div>
        <div className="s"><b>{stats.confirmed}</b><span>confirmed</span></div>
        <div className="s"><b>{stats.pending}</b><span>awaiting payment</span></div>
      </div>

      <div className="pl-toolbar">
        <label>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button className="btn" onClick={() => load(from, to)}>Apply</button>
        <button className="btn btn--quiet" onClick={() => load(today, addDays(today, 13))}>Next 2 weeks</button>
        <button className="btn btn--quiet" onClick={() => load(today, addDays(today, 29))}>Next month</button>
        <button className="btn btn--quiet" onClick={() => data && load(addDays(data.from, -7), addDays(data.to, -7))}>◀ back</button>
        <button className="btn btn--quiet" onClick={() => data && load(addDays(data.from, 7), addDays(data.to, 7))}>forward ▶</button>
        <div className="pl-legend">
          <span><i className="pl-swatch" style={{ background: "#0044ff" }} /> confirmed</span>
          <span><i className="pl-swatch" style={{ background: "#f6a609" }} /> pending</span>
          <span><i className="pl-swatch" style={{ background: "#0f7b4d" }} /> completed</span>
          <span><i className="pl-swatch" style={{ background: "#c7cce0" }} /> blocked</span>
        </div>
      </div>

      {loading || !data ? <p className="muted">Loading the fleet…</p> : (
        <div className="pl-wrap">
          <div className="pl">
            <div className="pl-head">
              <div className="pl-corner">Vehicle</div>
              <div className="pl-days">
                {data.days.map((d) => (
                  <div key={d} className={`pl-day ${isWeekend(d) ? "weekend" : ""} ${d === today ? "today" : ""}`}>
                    <div className="dow">{DOW[new Date(`${d}T00:00:00Z`).getUTCDay()]}</div>
                    <div className="dnum">{Number(d.slice(8, 10))}</div>
                  </div>
                ))}
              </div>
            </div>

            {data.categories.length === 0 && <div className="pl-empty">No vehicles yet. Add some under Fleet &amp; pricing.</div>}
            {data.categories.map((cat) => (
              <div key={cat.class}>
                <div className="pl-cat">{cat.class}</div>
                {cat.vehicles.map((v) => (
                  <div className="pl-row" key={v.id}>
                    <div className="pl-label"><b>{v.name}</b><small>{v.slug}</small></div>
                    <div className="pl-track">
                      <div className="pl-cells">
                        {data.days.map((d) => <div key={d} className={`c ${isWeekend(d) ? "weekend" : ""} ${d === today ? "today" : ""}`} />)}
                      </div>
                      {data.blackouts.map((bo) => {
                        const s = span(bo.start, bo.end);
                        return s ? <div key={`bo-${v.id}-${bo.id}`} className="pl-blackout" style={s} title={bo.reason} /> : null;
                      })}
                      {v.blocks.map((bl) => {
                        const s = span(bl.start, bl.end);
                        return s ? <div key={bl.id} className="pl-block" style={s} title={bl.reason}>{bl.reason || "Blocked"}</div> : null;
                      })}
                      {v.bookings.map((b) => {
                        const s = span(b.start, b.end);
                        return s ? <div key={b.id} className={`pl-bar ${b.status}`} style={s} title={`${b.label} · ${b.start} to ${b.end} · ${b.status}`}>{b.label}</div> : null;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
