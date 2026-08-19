import { describe, it, expect } from "vitest";
import {
  loginCodeEmail, bookingConfirmedEmail, bookingCancelledEmail, adminNewBookingEmail, adminPaymentEmail,
  adminDocumentExpiringEmail,
} from "@/lib/email/templates";
import { atAruba, formatDateTime } from "@/lib/time/format";

const startAt = atAruba("2026-07-01", "09:00");
const endAt = atAruba("2026-07-08", "09:00");

// Fixed fixture id so the derived short reference (slice(0,8).toUpperCase(),
// the same derivation the confirmation page and the contract PDF use) is
// predictable across assertions below.
const bookingId = "7f83a1c9-40dd-4c5b-8e77-121212121212";
const shortRef = "7F83A1C9";

const all = [
  loginCodeEmail({ code: "482917", link: "https://x/verify?code=482917" }),
  bookingConfirmedEmail({
    bookingId, vehicleClass: "SUV", vehicleName: "Hyundai Creta", customerName: "Maria Garcia",
    startAt, endAt, rentalTotalCents: 34800, amountPaidCents: 4000, chargeType: "rental_deposit", currency: "USD", paid: true,
  }),
  bookingCancelledEmail({ vehicleName: "Kia Picanto", startAt, endAt: atAruba("2026-07-05", "09:00"), refund: { refunded: true, refundCents: 4000 }, cancellationWindowHours: 48, currency: "USD" }),
  adminNewBookingEmail({ vehicleName: "Kia Sportage", startAt, endAt, customerEmail: "a@b.com", paymentOption: "deposit" }),
  adminPaymentEmail({ vehicleName: "Kia Sportage", startAt, endAt, amountCents: 4000, currency: "USD", customerEmail: "a@b.com" }),
  adminDocumentExpiringEmail({ vehicleName: "Hyundai Creta", plate: "A-9876", kind: "insurance", dueOn: "2026-08-20", daysLeft: 7 }),
  adminDocumentExpiringEmail({ vehicleName: "Hyundai Creta", plate: "A-9876", kind: "inspection", dueOn: "2026-06-01", daysLeft: -3 }),
];

describe("email templates", () => {
  it("set a subject and render the key facts", () => {
    expect(loginCodeEmail({ code: "482917", link: "https://x" }).html).toContain("482917");
    const conf = bookingConfirmedEmail({
      bookingId, vehicleClass: "SUV", vehicleName: "Hyundai Creta", customerName: "Maria Garcia",
      startAt, endAt: atAruba("2026-07-08", "09:00"), rentalTotalCents: 34800, amountPaidCents: 4000, chargeType: "rental_deposit", currency: "USD", paid: true,
    }).html;
    expect(conf).toContain("USD 40.00");   // what they actually paid (reservation fee)
    expect(conf).toContain("USD 348.00");  // rental total, clearly labelled
    expect(adminPaymentEmail({ vehicleName: "X", startAt, endAt, amountCents: 4000, currency: "USD", customerEmail: "a@b.com" }).subject).toContain("USD 40.00");
  });

  it("all have a non-empty subject and html", () => {
    for (const e of all) {
      expect(e.subject.length).toBeGreaterThan(0);
      expect(e.html.length).toBeGreaterThan(0);
    }
  });

  it("render the rental period as human wall time via formatDateTime, never raw ISO", () => {
    const period = `${formatDateTime(startAt)} to ${formatDateTime(endAt)}`;

    const confirmed = bookingConfirmedEmail({
      bookingId, vehicleClass: "SUV", vehicleName: "Hyundai Creta", customerName: "Maria Garcia",
      startAt, endAt, rentalTotalCents: 34800, amountPaidCents: 4000, chargeType: "rental_deposit", currency: "USD", paid: true,
    });
    // The redesign renders pickup and return as separate summary-table rows
    // (booking summary as a clean table, spec), not one "X to Y" sentence, so
    // this checks both formatted stamps land rather than the old contiguous
    // substring. Still proves Aruba wall time via formatDateTime, never raw ISO.
    expect(confirmed.html).toContain(formatDateTime(startAt));
    expect(confirmed.html).toContain(formatDateTime(endAt));
    expect(confirmed.html).not.toContain(startAt);

    const cancelled = bookingCancelledEmail({ vehicleName: "Kia Picanto", startAt, endAt, refund: { refunded: false, refundCents: 0 }, cancellationWindowHours: 48, currency: "USD" });
    expect(cancelled.html).toContain(period);
    expect(cancelled.html).not.toContain(startAt);

    const adminNew = adminNewBookingEmail({ vehicleName: "Kia Sportage", startAt, endAt, customerEmail: "a@b.com", paymentOption: "deposit" });
    expect(adminNew.html).toContain(period);
    expect(adminNew.subject).toContain(formatDateTime(startAt));
    expect(adminNew.html).not.toContain(startAt);

    const adminPay = adminPaymentEmail({ vehicleName: "Kia Sportage", startAt, endAt, amountCents: 4000, currency: "USD", customerEmail: "a@b.com" });
    expect(adminPay.html).toContain(period);
    expect(adminPay.html).not.toContain(startAt);
  });

  it("contain no em-dashes (house writing rule)", () => {
    for (const e of all) {
      expect(e.subject).not.toContain("—");
      expect(e.html).not.toContain("—");
      expect(e.subject).not.toContain("--");
    }
  });

  it("bookingCancelledEmail renders the refund outcome (spec §16)", () => {
    const refunded = bookingCancelledEmail({
      vehicleName: "Kia Picanto", startAt, endAt,
      refund: { refunded: true, refundCents: 4000 }, cancellationWindowHours: 48, currency: "USD",
    });
    expect(refunded.html).toContain("USD 40.00");
    expect(refunded.html).toContain("refunded to your card");

    const notEligible = bookingCancelledEmail({
      vehicleName: "Kia Picanto", startAt, endAt,
      refund: { refunded: false, refundCents: 0 }, cancellationWindowHours: 48, currency: "USD",
    });
    expect(notEligible.html).toContain("Cancelled within 48 hours of pickup");
    expect(notEligible.html).toContain("not refunded");

    const errored = bookingCancelledEmail({
      vehicleName: "Kia Picanto", startAt, endAt,
      refund: { refunded: false, refundCents: 0, refundError: true }, cancellationWindowHours: 48, currency: "USD",
    });
    expect(errored.html).toContain("refund is being processed");

    // Admin override: cancelled outside the window (policySaysFree true) but
    // the admin explicitly denied the refund. Must not blame the window policy.
    const overrideDenied = bookingCancelledEmail({
      vehicleName: "Kia Picanto", startAt, endAt,
      refund: { refunded: false, refundCents: 0, policySaysFree: true }, cancellationWindowHours: 48, currency: "USD",
    });
    expect(overrideDenied.html).toContain("not refunded");
    expect(overrideDenied.html).not.toContain("Cancelled within 48 hours of pickup");
  });

  it("bookingConfirmedEmail (desk/unpaid) renders the branded table summary, WhatsApp contact, and pay-at-pickup note (2026-08-19 redesign)", () => {
    const desk = bookingConfirmedEmail({
      bookingId, vehicleClass: "SUV", vehicleName: "Hyundai Creta", customerName: "Maria Garcia",
      startAt, endAt, rentalTotalCents: 34800, currency: "USD",
      depositCents: 15000,
      paid: false,
    });
    const html = desk.html;

    // Header band wordmark: TEX white, CARS coral, matching the public app
    // shell's own two-tone split (src/app/(public)/layout.tsx's pub-brand-word).
    expect(html).toContain('>TEX<span style="color:#f15f2c">CARS</span></span>');

    // Confirmation headline, "energy" text, no exclamation mark.
    expect(html).toContain("Your booking is confirmed</h1>");

    // A line with the renter's first name only (not the full "Maria Garcia").
    expect(html).toContain("Hi Maria,");
    expect(html).not.toContain("Hi Maria Garcia");

    // Booking summary as a clean table: class + car, pickup/return (Aruba
    // local via formatDateTime), rental total, refundable deposit, and the
    // reservation reference (booking id short form).
    expect(html).toContain(">Class<");
    expect(html).toContain(">SUV<");
    expect(html).toContain(">Car<");
    expect(html).toContain(">Hyundai Creta<");
    expect(html).toContain(">Pickup<");
    expect(html).toContain(formatDateTime(startAt));
    expect(html).toContain(">Return<");
    expect(html).toContain(formatDateTime(endAt));
    expect(html).toContain(">Rental total<");
    expect(html).toContain("USD 348.00");
    expect(html).toContain(">Refundable deposit<");
    expect(html).toContain("USD 150.00");
    expect(html).toContain(">Reservation reference<");
    expect(html).toContain(shortRef);

    // Pay-at-pickup note: cash or card at the desk, nothing charged online.
    // Regression-equivalent to desk-confirm-copy.test.ts's pinned check: never
    // a payment claim in the desk/unpaid customer email.
    expect(html).toContain("pay at pickup");
    expect(html).toContain("cash or card");
    expect(html.toLowerCase()).not.toContain("payment");

    // "Questions or special requests": bulletproof WhatsApp button (a padded
    // table-cell link, not a bare <a>), the number written out, and reply-to
    // this email as the alternative.
    expect(html).toContain("Questions or special requests");
    expect(html).toMatch(/<td[^>]*background-color:#f15f2c[^>]*>\s*<a href="https:\/\/wa\.me\/2975945454"/);
    expect(html).toContain("Message us on WhatsApp");
    expect(html).toContain("+297 594 5454");
    expect(html).toContain('href="tel:+2975945454"');
    expect(html).toContain("reply to this email");

    // Bring-your-license reminder.
    expect(html).toContain("driver's license");

    // Quiet footer.
    expect(html).toContain("Tex Cars &amp; Leasing, Aruba");
    expect(html).toContain("tex-cars.com");
    expect(html).toContain("We bring the car to you.");

    // Real-HTML-email discipline: table layout, 600px centered, nothing Gmail
    // strips, every style inline (no <style> block to carry any of this).
    expect(html).toContain('<table role="presentation"');
    expect(html).toContain("max-width:600px");
    expect(html).not.toContain("<style");
    expect(html).not.toMatch(/display:\s*flex/);
    expect(html).not.toMatch(/display:\s*grid/);
    expect(html).not.toMatch(/position:\s*(absolute|relative|fixed)/);

    // Dark-mode-safe: white text appears in exactly two places, the navy
    // header band and the coral WhatsApp button, and both carry an explicit
    // background-color (plus a legacy bgcolor attribute) on that very same
    // table cell, so no dark-mode client can invert one half of the pair and
    // strand pale text on an assumed-white surface. The lookbehind excludes
    // "background-color:#ffffff" (the card surface, a background not a text
    // color) from the count.
    const whiteTextCount = (html.match(/(?<!-)color:#ffffff/g) ?? []).length;
    expect(whiteTextCount).toBe(2); // header wordmark span + WhatsApp button link
    expect(html).toContain('<td style="background-color:#15192f;padding:28px 32px;text-align:center;border-radius:14px 14px 0 0" bgcolor="#15192f">');
    expect(html).toContain('<td style="border-radius:8px;background-color:#f15f2c" bgcolor="#f15f2c">');
  });

  it("bookingConfirmedEmail omits the refundable deposit row when no deposit is set on the class", () => {
    const noDeposit = bookingConfirmedEmail({
      bookingId, vehicleClass: "Economy", vehicleName: "Kia Picanto", customerName: "Jo",
      startAt, endAt, rentalTotalCents: 20000, currency: "USD",
      depositCents: null,
      paid: false,
    });
    expect(noDeposit.html).not.toContain("Refundable deposit");

    const withDeposit = bookingConfirmedEmail({
      bookingId, vehicleClass: "Economy", vehicleName: "Kia Picanto", customerName: "Jo",
      startAt, endAt, rentalTotalCents: 20000, currency: "USD",
      depositCents: 5000,
      paid: false,
    });
    expect(withDeposit.html).toContain("Refundable deposit");
    expect(withDeposit.html).toContain("USD 50.00");
  });

  it("bookingConfirmedEmail escapes customer and vehicle text so it cannot break the markup", () => {
    const unsafe = bookingConfirmedEmail({
      bookingId, vehicleClass: "SUV", vehicleName: "Toyota <4Runner> & Co", customerName: "<b>Al</b> Smith",
      startAt, endAt, rentalTotalCents: 20000, currency: "USD", paid: false,
    });
    expect(unsafe.html).not.toContain("<4Runner>");
    expect(unsafe.html).toContain("Toyota &lt;4Runner&gt; &amp; Co");
    expect(unsafe.html).not.toContain("<b>Al</b>");
    expect(unsafe.html).toContain("Hi &lt;b&gt;Al&lt;/b&gt;,");
  });

  it("document expiring email states the document, the car, and the timing", () => {
    const soon = adminDocumentExpiringEmail({ vehicleName: "Kia Picanto", plate: "A-1234", kind: "insurance", dueOn: "2026-08-20", daysLeft: 24 });
    expect(soon.subject).toContain("Insurance due soon");
    expect(soon.subject).toContain("A-1234");
    expect(soon.html).toContain("24 days");
    expect(soon.html).toContain("2026-08-20");

    const today = adminDocumentExpiringEmail({ vehicleName: "Kia Picanto", plate: "A-1234", kind: "inspection", dueOn: "2026-07-27", daysLeft: 0 });
    expect(today.html).toContain("due today");

    const over = adminDocumentExpiringEmail({ vehicleName: "Kia Picanto", plate: "A-1234", kind: "inspection", dueOn: "2026-07-01", daysLeft: -5 });
    expect(over.subject).toContain("Inspection overdue");
    expect(over.html).toContain("overdue");
  });
});
