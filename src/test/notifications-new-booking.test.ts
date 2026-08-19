/**
 * Regression (Task 3, desk-mode adoption wave): notifyNewBooking's admin
 * alert must fan out to EVERY configured recipient in
 * settings.adminAlertRecipients, not silently drop to one. sendAndLog/
 * sendToMany run for real elsewhere; here we only need to see who
 * notifyNewBooking actually tried to reach and with what. Recipients are
 * never hardcoded in notifications.ts: they come straight from settings, so
 * this also proves that wiring by using two addresses that are not the
 * seed/prod default.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { vehicles, customers, bookings } from "@/lib/db/schema";
import { atAruba } from "@/lib/time/format";
import type { OutboundEmail } from "@/lib/email/send";

const sendAndLog = vi.fn<(msg: OutboundEmail) => Promise<"skipped">>(async () => "skipped");
const sendToMany = vi.fn<(recipients: string[], build: (to: string) => OutboundEmail) => Promise<undefined>>(async () => undefined);
vi.mock("@/lib/email/send", () => ({
  sendAndLog: (msg: OutboundEmail) => sendAndLog(msg),
  sendToMany: (recipients: string[], build: (to: string) => OutboundEmail) => sendToMany(recipients, build),
}));

// Owner-channel spies. sendOwnerTelegram was retired from notifyNewBooking's
// wiring (desk-mode adoption wave: the approval broadcast is the Telegram
// surface for new bookings, so a bare ping here would double-message the
// owner; PORT-LOG Note 16(e)). Its spy must stay UNCALLED; the WhatsApp spy
// proves the mock wiring is live rather than vacuous. notifyAdmin stays real
// (the bell row is part of the flow under test).
const sendOwnerTelegram = vi.fn<(text: string) => Promise<void>>(async () => undefined);
const sendOwnerWhatsApp = vi.fn<(text: string) => Promise<void>>(async () => undefined);
vi.mock("@/lib/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/notify")>();
  return {
    ...actual,
    sendOwnerTelegram: (text: string) => sendOwnerTelegram(text),
    sendOwnerWhatsApp: (text: string) => sendOwnerWhatsApp(text),
  };
});

import { notifyNewBooking } from "@/lib/email/notifications";
import { patchSettings } from "@/lib/admin/settings";

let db: Awaited<ReturnType<typeof getDb>>;

beforeAll(async () => {
  db = await getDb();
  await runMigrations();
  await patchSettings({ adminAlertRecipients: ["owner-a@texcars.example", "owner-b@texcars.example", "owner-c@texcars.example"] });
});

describe("notifyNewBooking admin fan-out", () => {
  it("emails every recipient in settings.adminAlertRecipients, not just the first", async () => {
    const [v] = await db.insert(vehicles).values({
      slug: "new-booking-notif-car", plate: "PL-NEWBK-NOTIF", class: "SUV", name: "New Booking Notif Car",
      seats: 5, transmission: "Automatic", doors: 5, priceDayCents: 5800, priceWeekCents: 34800, priceMonthCents: 118000,
    }).returning();
    const [c] = await db.insert(customers).values({ email: "new-booking-notif@test.com" }).returning();
    const [b] = await db.insert(bookings).values({
      vehicleId: v!.id, customerId: c!.id,
      startAt: atAruba("2028-01-08", "09:00"), endAt: atAruba("2028-01-15", "09:00"), bufferEndAt: atAruba("2028-01-16", "09:00"),
      status: "pending", priceBreakdown: { subtotalCents: 34800, currency: "USD" }, paymentOption: "full",
      acceptedPolicyVersion: 1, acceptedAt: new Date(), idempotencyKey: "new-booking-notif-1",
    }).returning();

    sendToMany.mockClear();
    sendAndLog.mockClear();
    await notifyNewBooking(b!.id);

    expect(sendToMany).toHaveBeenCalledTimes(1);
    const [recipients, build] = sendToMany.mock.calls[0]!;
    // All three configured recipients, in order, none dropped.
    expect(recipients).toEqual(["owner-a@texcars.example", "owner-b@texcars.example", "owner-c@texcars.example"]);
    // Each recipient renders its own addressed copy (sendToMany's real
    // implementation calls `build(to)` once per recipient; here we call it
    // ourselves to prove every one of them renders the same correct content).
    for (const to of recipients) {
      const rendered = build(to);
      expect(rendered.type).toBe("admin_new_booking");
      expect(rendered.html).toContain("New Booking Notif Car");
      expect(rendered.html).toContain("new-booking-notif@test.com");
    }
  });

  it("fans out to zero recipients (not an error) when settings has none configured", async () => {
    await patchSettings({ adminAlertRecipients: [] });
    const [v] = await db.insert(vehicles).values({
      slug: "new-booking-notif-car-2", plate: "PL-NEWBK-NOTIF-2", class: "SUV", name: "New Booking Notif Car 2",
      seats: 5, transmission: "Automatic", doors: 5, priceDayCents: 5800, priceWeekCents: 34800, priceMonthCents: 118000,
    }).returning();
    const [c] = await db.insert(customers).values({ email: "new-booking-notif-2@test.com" }).returning();
    const [b] = await db.insert(bookings).values({
      vehicleId: v!.id, customerId: c!.id,
      startAt: atAruba("2028-02-08", "09:00"), endAt: atAruba("2028-02-15", "09:00"), bufferEndAt: atAruba("2028-02-16", "09:00"),
      status: "pending", priceBreakdown: { subtotalCents: 34800, currency: "USD" }, paymentOption: "full",
      acceptedPolicyVersion: 1, acceptedAt: new Date(), idempotencyKey: "new-booking-notif-2",
    }).returning();

    sendToMany.mockClear();
    await notifyNewBooking(b!.id);

    expect(sendToMany).toHaveBeenCalledTimes(1);
    const [recipients] = sendToMany.mock.calls[0]!;
    expect(recipients).toEqual([]);

    // Restore for any test ordered after this one in the same file/suite.
    await patchSettings({ adminAlertRecipients: ["owner-a@texcars.example", "owner-b@texcars.example", "owner-c@texcars.example"] });
  });

  it("never sends the retired owner Telegram ping (the approval broadcast replaced it)", async () => {
    const [v] = await db.insert(vehicles).values({
      slug: "new-booking-notif-car-3", plate: "PL-NEWBK-NOTIF-3", class: "SUV", name: "New Booking Notif Car 3",
      seats: 5, transmission: "Automatic", doors: 5, priceDayCents: 5800, priceWeekCents: 34800, priceMonthCents: 118000,
    }).returning();
    const [c] = await db.insert(customers).values({ email: "new-booking-notif-3@test.com" }).returning();
    const [b] = await db.insert(bookings).values({
      vehicleId: v!.id, customerId: c!.id,
      startAt: atAruba("2028-03-08", "09:00"), endAt: atAruba("2028-03-15", "09:00"), bufferEndAt: atAruba("2028-03-16", "09:00"),
      status: "pending", priceBreakdown: { subtotalCents: 34800, currency: "USD" }, paymentOption: "full",
      acceptedPolicyVersion: 1, acceptedAt: new Date(), idempotencyKey: "new-booking-notif-3",
    }).returning();

    sendOwnerTelegram.mockClear();
    sendOwnerWhatsApp.mockClear();
    await notifyNewBooking(b!.id);

    // The bare Telegram ping is retired from this wiring: with TELEGRAM_CHAT_ID
    // set in prod it would double-message the owner alongside the rich approval
    // broadcast. The WhatsApp call proves the flow reached the owner-channel
    // step and the spies are wired, so the zero above is a real zero.
    expect(sendOwnerTelegram).not.toHaveBeenCalled();
    expect(sendOwnerWhatsApp).toHaveBeenCalledTimes(1);
  });
});
