import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * sendOwnerTelegram (src/lib/notify.ts). Dormant-until-configured contract,
 * mirroring the WhatsApp owner channel. Follows the env-override style in
 * env-validation.test.ts / reservation-mode.test.ts (snapshot + hard restore
 * process.env, vi.resetModules() before every dynamic re-import of @/env or
 * anything that imports it, since env.ts freezes its parsed env at import time).
 */

const ORIGINAL = { ...process.env };
function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL);
}

beforeEach(() => vi.resetModules());
afterEach(() => {
  restoreEnv();
  vi.unstubAllGlobals();
});

describe("sendOwnerTelegram", () => {
  it("is dormant (skips, does not call fetch) when TELEGRAM_* is unconfigured", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { sendOwnerTelegram } = await import("@/lib/notify");
    await expect(sendOwnerTelegram("hello")).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts to the Telegram Bot API with the right URL and body when configured", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    process.env.TELEGRAM_CHAT_ID = "12345";
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchSpy);

    const { sendOwnerTelegram } = await import("@/lib/notify");
    await sendOwnerTelegram("New booking: Test Car");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.telegram.org/bottest-bot-token/sendMessage");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "content-type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ chat_id: "12345", text: "New booking: Test Car" });
  });

  it("throws when the Telegram API responds non-ok", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    process.env.TELEGRAM_CHAT_ID = "12345";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));

    const { sendOwnerTelegram } = await import("@/lib/notify");
    await expect(sendOwnerTelegram("hello")).rejects.toThrow(/telegram api 400/);
  });
});

describe("sendOwnerTelegram containment shape", () => {
  it("a Telegram fetch failure never surfaces through sendOwnerTelegram(...).catch(...)", async () => {
    // No production call site remains: notifyNewBooking's bare ping was retired
    // (desk-mode adoption wave; the approval broadcast is the Telegram surface
    // for new bookings now, see PORT-LOG Note 16(e)), but the module stays
    // exported for compliance/ops use. Any future caller must use the
    // sendOwnerTelegram(...).catch(() => undefined) containment shape the
    // WhatsApp channel's callers already use; pin that shape here: a rejected
    // send must resolve to undefined, never throw.
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    process.env.TELEGRAM_CHAT_ID = "12345";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const { sendOwnerTelegram } = await import("@/lib/notify");
    await expect(sendOwnerTelegram("hello").catch(() => undefined)).resolves.toBeUndefined();
  });
});
