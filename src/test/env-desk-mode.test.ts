import { describe, it, expect, vi } from "vitest";

/**
 * PAYMENT_MODE=desk must boot without any Stripe env (the whole point of desk
 * mode: clients whose country Stripe does not support, or who simply don't
 * want online payment). PAYMENT_MODE=stripe (Tex's online-checkout literal,
 * and the default) must still fail closed without Stripe keys. NEXT_PUBLIC_
 * PAYMENT_MODE must be set to the same value as PAYMENT_MODE (src/env.ts's
 * superRefine requires them to match). env.ts freezes on first import, so
 * each case re-imports after vi.resetModules().
 */
describe("env PAYMENT_MODE", () => {
  it("desk mode boots with no Stripe keys and exposes isDeskMode", async () => {
    vi.resetModules();
    process.env.PAYMENT_MODE = "desk";
    process.env.NEXT_PUBLIC_PAYMENT_MODE = "desk";
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const mod = await import("@/env");
    expect(mod.env.PAYMENT_MODE).toBe("desk");
    expect(mod.isDeskMode).toBe(true);
    expect(mod.env.STRIPE_SECRET_KEY).toBe("");
  });

  it("stripe mode still fails closed without Stripe keys", async () => {
    vi.resetModules();
    process.env.PAYMENT_MODE = "stripe";
    process.env.NEXT_PUBLIC_PAYMENT_MODE = "stripe";
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    await expect(import("@/env")).rejects.toThrow(/Environment validation failed/);
  });

  it("default mode is stripe and accepts the test Stripe keys", async () => {
    vi.resetModules();
    delete process.env.PAYMENT_MODE;
    delete process.env.NEXT_PUBLIC_PAYMENT_MODE;
    process.env.STRIPE_SECRET_KEY = "sk_test_0000000000000000000000000000";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_testtesttesttesttesttest00";
    const mod = await import("@/env");
    expect(mod.env.PAYMENT_MODE).toBe("stripe");
    expect(mod.isDeskMode).toBe(false);
  });

  it("PAYMENT_MODE=reserve fails closed with a message naming the desk rename", async () => {
    vi.resetModules();
    process.env.PAYMENT_MODE = "reserve";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(import("@/env")).rejects.toThrow(/renamed to "desk"/);
    } finally {
      spy.mockRestore();
    }
  });
});
