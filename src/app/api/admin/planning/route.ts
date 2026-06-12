import { z } from "zod";
import { withRoute } from "@/lib/http/handler";
import { json } from "@/lib/http/respond";
import { parseParams } from "@/lib/http/validate";
import { read } from "@/lib/admin/guard";
import { getPlanning } from "@/lib/admin/planning";
import { arubaToday } from "@/lib/booking/public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Calendar-valid date: the regex checks shape, the refine rejects impossible
// dates (2026-13-45, 2026-02-30) that would otherwise NaN the date arithmetic.
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
  (s) => {
    const t = Date.parse(`${s}T00:00:00Z`);
    if (Number.isNaN(t)) return false; // guard before toISOString (which would throw on NaN)
    return new Date(t).toISOString().slice(0, 10) === s;
  },
  "must be a valid calendar date",
);
const QuerySchema = z.object({ from: isoDate.optional(), to: isoDate.optional() });

/** GET /api/admin/planning?from&to — fleet timeline data. Defaults to a 2-week
 *  window from today when no range is given. Capped at 60 days. */
export const GET = withRoute(async (req) => {
  const url = new URL(req.url);
  const q = parseParams(Object.fromEntries(url.searchParams), QuerySchema);
  const from = q.from ?? arubaToday();
  let to = q.to ?? new Date(Date.parse(`${from}T00:00:00Z`) + 13 * 86_400_000).toISOString().slice(0, 10);
  // clamp to <= 60 days
  const maxTo = new Date(Date.parse(`${from}T00:00:00Z`) + 59 * 86_400_000).toISOString().slice(0, 10);
  if (to > maxTo) to = maxTo;
  if (to < from) to = from;
  return json(await read(req, () => getPlanning(from, to)), req);
});
