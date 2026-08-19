process.env.PAYMENT_MODE = "desk";
// NEXT_PUBLIC_PAYMENT_MODE must match PAYMENT_MODE (src/env.ts's superRefine) -
// a Tex-only requirement FD's own env.ts has no equivalent of.
process.env.NEXT_PUBLIC_PAYMENT_MODE = "desk";
delete process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_WEBHOOK_SECRET;

import { describe, it, expect, beforeAll } from "vitest";

beforeAll(async () => {
  const { runMigrations } = await import("@/lib/db/migrate");
  await runMigrations();
});

describe("desk mode surfaces", () => {
  it("booking-config tells the wizard it is desk mode", async () => {
    const { GET } = await import("@/app/api/booking-config/route");
    const res = await GET(new Request("http://localhost:3000/api/booking-config", { headers: { "user-agent": "t" } }), { params: Promise.resolve({}) });
    expect((await res.json()).paymentMode).toBe("desk");
  });
});
