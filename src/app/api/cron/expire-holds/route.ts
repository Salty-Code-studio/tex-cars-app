import { NextResponse } from "next/server";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { expireStaleHolds } from "@/lib/payments/holds";
import { sweepInspectionMedia, sweepDriverLicenses } from "@/lib/admin/inspections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/expire-holds - runs every 15 minutes (vercel.json, and
 * wrangler.jsonc's Cloudflare trigger + worker/index.ts's cron-keyed
 * dispatch). Authenticated by the CRON_SECRET bearer token; refuses to run
 * without it. Three chores: cancel stale unpaid pending holds, purge
 * inspection media past the licenseRetentionDays window (wave 06), and purge
 * driver_licenses rows past their own retainUntil timer (bug fix: nothing
 * consumed that timer before, so licence PII was retained forever). Both
 * purges query rows past their own retention cutoff and are idempotent (a
 * no-op once already purged), so running them every 15 minutes instead of
 * once a day (FD's own cadence for this same route, not adopted here per
 * wave 03's Note 11(b)) costs one extra, cheap, no-op-on-repeat query per
 * tick rather than a correctness issue.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const auth = req.headers.get("authorization");
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cancelled = await expireStaleHolds(30); // holds older than 30 min, unpaid
  const mediaPurged = await sweepInspectionMedia();
  const licensesPurged = await sweepDriverLicenses();
  logger.info("cron_expire_holds", { cancelled, mediaPurged, licensesPurged });
  return NextResponse.json({ ok: true, cancelled, mediaPurged, licensesPurged });
}
