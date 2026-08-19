import { describe, it, expect, beforeAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { emailLog } from "@/lib/db/schema";

// getResend() is a memoized singleton in resend-client.ts (real key or null,
// cached for the module's lifetime), so the only way to exercise sendAndLog's
// "sent" and "failed" branches in this suite (RESEND_API_KEY is never set by
// src/test/setup.ts) is to replace the whole module and control its return
// value per test. Defaults to null (unconfigured), matching the untouched
// suite's behavior, so the describe block below is unaffected.
const getResend = vi.fn<() => unknown>(() => null);
vi.mock("@/lib/email/resend-client", () => ({ getResend: () => getResend() }));

import { sendAndLog } from "@/lib/email/send";

let db: Awaited<ReturnType<typeof getDb>>;

beforeAll(async () => { db = await getDb(); await runMigrations(); });

describe("sendAndLog (no Resend key configured)", () => {
  it("skips delivery, records an email_log row, and never throws", async () => {
    const status = await sendAndLog({ to: "x@test.com", type: "login_code", subject: "Hi", html: "<p>hi</p>" });
    expect(status).toBe("skipped");
    const rows = await db.select().from(emailLog).where(eq(emailLog.to, "x@test.com"));
    expect(rows.length).toBe(1);
    expect(rows[0]!.status).toBe("skipped");
    expect(rows[0]!.type).toBe("login_code");
  });
});

// Task 3 (desk-mode adoption wave): the "zero rows in prod" observation named
// the SKIPPED path specifically, but the suite had no coverage at all for the
// "sent" or "failed" branches (RESEND_API_KEY is never set in tests, so every
// prior run only ever touched skip). Closing that gap here: all three
// SendStatus outcomes now have a row-level assertion against a real email_log
// insert, not just a mocked return value.
describe("sendAndLog (Resend configured)", () => {
  it("records a sent row with the provider id when Resend succeeds", async () => {
    getResend.mockReturnValueOnce({
      emails: { send: vi.fn(async () => ({ data: { id: "re_test_sent_1" }, error: null })) },
    });
    const status = await sendAndLog({ to: "sent@test.com", type: "booking_confirmed", subject: "Hi", html: "<p>hi</p>" });
    expect(status).toBe("sent");
    const rows = await db.select().from(emailLog).where(eq(emailLog.to, "sent@test.com"));
    expect(rows.length).toBe(1);
    expect(rows[0]!.status).toBe("sent");
    expect(rows[0]!.providerId).toBe("re_test_sent_1");
  });

  it("records a failed row (not a thrown error) when Resend returns an error payload", async () => {
    getResend.mockReturnValueOnce({
      emails: { send: vi.fn(async () => ({ data: null, error: { message: "bad request" } })) },
    });
    const status = await sendAndLog({ to: "failed@test.com", type: "booking_confirmed", subject: "Hi", html: "<p>hi</p>" });
    expect(status).toBe("failed");
    const rows = await db.select().from(emailLog).where(eq(emailLog.to, "failed@test.com"));
    expect(rows.length).toBe(1);
    expect(rows[0]!.status).toBe("failed");
    expect(rows[0]!.providerId).toBeNull();
  });

  it("records a failed row when the Resend call throws outright", async () => {
    getResend.mockReturnValueOnce({
      emails: { send: vi.fn(async () => { throw new Error("network blip"); }) },
    });
    const status = await sendAndLog({ to: "threw@test.com", type: "booking_confirmed", subject: "Hi", html: "<p>hi</p>" });
    expect(status).toBe("failed");
    const rows = await db.select().from(emailLog).where(eq(emailLog.to, "threw@test.com"));
    expect(rows.length).toBe(1);
    expect(rows[0]!.status).toBe("failed");
  });

  it("each outcome writes exactly one row, never zero and never a duplicate", async () => {
    getResend.mockReturnValueOnce({
      emails: { send: vi.fn(async () => ({ data: { id: "re_test_count" }, error: null })) },
    });
    await sendAndLog({ to: "count-sent@test.com", type: "login_code", subject: "Hi", html: "<p>hi</p>" });
    getResend.mockReturnValueOnce(null);
    await sendAndLog({ to: "count-skipped@test.com", type: "login_code", subject: "Hi", html: "<p>hi</p>" });
    getResend.mockReturnValueOnce({
      emails: { send: vi.fn(async () => ({ data: null, error: { message: "nope" } })) },
    });
    await sendAndLog({ to: "count-failed@test.com", type: "login_code", subject: "Hi", html: "<p>hi</p>" });

    for (const to of ["count-sent@test.com", "count-skipped@test.com", "count-failed@test.com"]) {
      const rows = await db.select().from(emailLog).where(eq(emailLog.to, to));
      expect(rows.length).toBe(1);
    }
  });
});
