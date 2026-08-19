/**
 * Transactional email templates (spec §9). Brand-aligned, plain, warm, and
 * dash-free (house writing rule). Pure functions → unit-testable.
 */
import { formatDateTime } from "@/lib/time/format";
import { siteConfig } from "@/lib/site-config";

export interface RenderedEmail {
  subject: string;
  html: string;
}

const BRAND = "#2348c7";
const INK = "#15192f";
// Palette additions for bookingConfirmedEmail's table-based redesign (below).
// Kept alongside BRAND/INK rather than folded into shell() so the rest of the
// templates (which all still render through shell()) are untouched.
const CORAL = "#f15f2c";  // the ONE accent: the WhatsApp button, nothing else
const SAND = "#f7f8fc";   // warm-white canvas, matches the public app's --sand
const MUTED = "#4a5170";  // secondary text, matches the public app's --ink-soft
const LINE = "#e6e9f2";   // hairline rule, matches the public app's --line

function shell(title: string, body: string): string {
  // Brand div/footer stay Tex's own literal markup: the two-tone TEX/CARS
  // color split and the full "Tex Cars & Leasing" legal name are not things
  // siteConfig's single short display string (see loginCodeEmail below) can
  // represent. subject lines that need only the short name use siteConfig.
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Inter,sans-serif;color:${INK};max-width:520px;margin:0 auto;padding:24px">
  <div style="font-weight:800;letter-spacing:.03em;font-size:18px;margin-bottom:20px">TEX<span style="color:#f15f2c">CARS</span></div>
  <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
  ${body}
  <p style="color:#828aa6;font-size:12px;margin-top:28px">Tex Cars &amp; Leasing, Aruba. We bring the car to you.</p>
</div>`;
}

const money = (cents: number, currency: string) => `${currency} ${(cents / 100).toFixed(2)}`;

export function loginCodeEmail(args: { code: string; link: string }): RenderedEmail {
  return {
    subject: `Your ${siteConfig.siteName} sign-in code`,
    html: shell("Sign in to your bookings", `
      <p>Use this code to sign in. It is good for 15 minutes.</p>
      <p style="font-size:30px;font-weight:800;letter-spacing:6px;color:${BRAND};margin:16px 0">${args.code}</p>
      <p>Or just tap this link: <a href="${args.link}" style="color:${BRAND}">Sign in</a></p>
      <p style="color:#828aa6;font-size:13px">If you did not request this, you can ignore this email.</p>`),
  };
}

/**
 * The customer-facing "booking confirmed" email (spec §9, redesign 2026-08-19).
 * Real HTML email discipline: table layout, every style inline, 600px centered
 * card, system font stack, a text wordmark instead of a logo image, and no
 * property Gmail strips (no flexbox/grid/position anywhere). Explicit
 * background-color is paired with every explicit text color, so dark-mode
 * clients never invert one half of a pair and leave pale text stranded on an
 * assumed-white surface. Content reads correctly top to bottom in raw DOM
 * order (no CSS reordering), which stands in for a plain-text fallback since
 * this app's send path has no separate text/plain part (src/lib/email/send.ts).
 *
 * bookingConfirmedEmail still serves BOTH the online (`paid: true`, Stripe
 * webhook) and desk (`paid: false`, Telegram/email/admin confirm) origins
 * through notifyBookingConfirmed's one shared funnel, so this one redesign
 * covers both, and the online branch keeps its pinned opening sentence
 * byte-for-byte (src/test/desk-confirm-copy.test.ts's "byte-for-byte
 * unchanged" case) so a refactor here can never quietly start claiming a
 * payment that did not happen, or vice versa.
 */
export function bookingConfirmedEmail(args: {
  /** Full booking id; the email derives its own short reference from it, the
   *  same slice(0,8).toUpperCase() the confirmation page (book/confirmation/
   *  page.tsx's `reference`) and the rental contract PDF (admin/inspections.ts's
   *  `contractRef`) already use, so the number here, on screen, and on paper
   *  all match. */
  bookingId: string;
  vehicleClass: string; vehicleName: string; startAt: string; endAt: string;
  /** Renter's full name (customers.name); only the first name is greeted. */
  customerName: string;
  rentalTotalCents: number; currency: string;
  /** Refundable security hold from the quote snapshot (QuoteBreakdown's
   *  depositCents). Undefined/null until the owner sets a per-class deposit,
   *  in which case the row is simply omitted, same as the confirmation page. */
  depositCents?: number | null;
  amountPaidCents?: number; chargeType?: string;
  /** Whether a real online payment succeeded for this booking. Keyed on DATA
   *  (the caller already looked up the payment row), never on deployment
   *  mode: a desk-mode confirmation has no payment to claim, so the copy
   *  must say so instead of thanking the customer for a charge that never
   *  happened. */
  paid: boolean;
}): RenderedEmail {
  const CHARGE_LABEL: Record<string, string> = {
    reservation_fee: "(reservation fee)",
    deposit: "(refundable deposit)",
    rental_deposit: "(deposit, balance due at pickup)",
    rental_full: "(paid in full)",
    extension: "(extension payment)",
  };
  const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
  // Templates.ts renders every other email unescaped too (see file history);
  // this one gets its own minimal guard since it is the redesign in scope,
  // not a repo-wide sweep. Only the DB-sourced text fields need it: the
  // reference is a derived hex slice and every href below is either a
  // literal or siteConfig, never user input.
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const first = esc(args.customerName.trim().split(/\s+/)[0] || "there");
  const ref = args.bookingId.slice(0, 8).toUpperCase();
  const siteHost = siteConfig.siteUrl.replace(/^https?:\/\//, "");

  const greetingLine = args.paid
    ? `Hi ${first}. Thanks, your payment came through and your car is reserved.`
    : `Hi ${first}, thanks for booking with Tex Cars.`;
  const payNoteLine = args.paid
    ? "Any remaining balance is settled with you at pickup."
    : "You pay at pickup, by cash or card at the desk. Nothing is charged online.";
  const preheader = args.paid
    ? "Your booking is confirmed. Payment received, see you at pickup."
    : "Your booking is confirmed. Pay at pickup, cash or card.";

  const rows: Array<[label: string, value: string, mono?: boolean]> = [
    ["Class", esc(args.vehicleClass)],
    ["Car", esc(args.vehicleName)],
    ["Pickup", formatDateTime(args.startAt)],
    ["Return", formatDateTime(args.endAt)],
  ];
  if (args.amountPaidCents !== undefined) {
    const label = CHARGE_LABEL[args.chargeType ?? ""] ?? "";
    rows.push(["Paid now", `${money(args.amountPaidCents, args.currency)}${label ? ` ${label}` : ""}`]);
  }
  rows.push(["Rental total", money(args.rentalTotalCents, args.currency)]);
  if (typeof args.depositCents === "number") {
    rows.push(["Refundable deposit", money(args.depositCents, args.currency)]);
  }
  rows.push(["Reservation reference", ref, true]);

  const rowsHtml = rows.map(([label, value, mono], i) => {
    const border = i < rows.length - 1 ? `border-bottom:1px solid ${LINE};` : "";
    return `
              <tr>
                <td style="padding:11px 2px;${border}color:${MUTED};font-size:13px;font-family:${FONT}">${label}</td>
                <td style="padding:11px 2px;${border}color:${INK};font-size:14px;font-weight:700;text-align:right;font-family:${mono ? MONO : FONT};${mono ? "letter-spacing:.04em;" : ""}">${value}</td>
              </tr>`;
  }).join("");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<meta name="x-apple-disable-message-reformatting">
<title>Booking confirmed</title>
</head>
<body style="margin:0;padding:0;background-color:${SAND}" bgcolor="${SAND}">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;color:${SAND}">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${SAND}" bgcolor="${SAND}">
<tr>
<td align="center" style="padding:32px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:14px;box-shadow:0 1px 2px rgba(21,25,47,0.06)" bgcolor="#ffffff">
<tr>
<td style="background-color:${INK};padding:28px 32px;text-align:center;border-radius:14px 14px 0 0" bgcolor="${INK}">
<span style="font-family:${FONT};font-size:20px;font-weight:800;letter-spacing:.04em;color:#ffffff">TEX<span style="color:${CORAL}">CARS</span></span>
</td>
</tr>
<tr>
<td style="padding:32px 32px 4px;font-family:${FONT}">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${INK};font-weight:700">Your booking is confirmed</h1>
<p style="margin:0;font-size:15px;line-height:1.6;color:${INK}">${greetingLine}</p>
</td>
</tr>
<tr>
<td style="padding:20px 32px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">${rowsHtml}
</table>
</td>
</tr>
<tr>
<td style="padding:18px 32px 4px;font-family:${FONT}">
<p style="margin:0;font-size:14px;line-height:1.6;color:${MUTED}">${payNoteLine}</p>
</td>
</tr>
<tr>
<td style="padding:24px 32px 8px;font-family:${FONT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${SAND};border-radius:10px" bgcolor="${SAND}">
<tr>
<td style="padding:22px 24px">
<p style="margin:0 0 8px;font-size:15px;font-weight:700;color:${INK}">Questions or special requests</p>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${MUTED}">Message us on WhatsApp any time and we will get right back to you.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="border-radius:8px;background-color:${CORAL}" bgcolor="${CORAL}">
<a href="https://wa.me/2975945454" target="_blank" rel="noreferrer" style="display:block;padding:13px 26px;font-family:${FONT};font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px">Message us on WhatsApp</a>
</td>
</tr>
</table>
<p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:${MUTED}">Or reach us at <a href="tel:+2975945454" style="color:${BRAND};text-decoration:underline">+297 594 5454</a>, or simply reply to this email.</p>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:4px 32px 28px;font-family:${FONT}">
<p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED}">Bring the driver's license you booked with when you pick up the car.</p>
</td>
</tr>
<tr>
<td style="padding:20px 32px 32px;border-top:1px solid ${LINE};font-family:${FONT}">
<p style="margin:0;font-size:12px;line-height:1.7;color:${MUTED}">Tex Cars &amp; Leasing, Aruba<br><a href="${siteConfig.siteUrl}" target="_blank" rel="noreferrer" style="color:${MUTED};text-decoration:underline">${siteHost}</a><br>We bring the car to you.</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;

  return {
    subject: `Your ${args.vehicleName} booking is confirmed`,
    html,
  };
}

// reservationConfirmedEmail (manual admin confirm from the ops board,
// deliberately no payment/paid language) lived here until 2026-08-19.
// Retired alongside notifyReservationConfirmed in src/lib/email/
// notifications.ts: bookingConfirmedEmail's new `paid` argument (above) now
// covers the same "no payment happened" case correctly for every confirm
// origin (Stripe webhook, Telegram tap, email link, admin button), through
// the one shared notifyBookingConfirmed funnel.

export function bookingCancelledEmail(args: {
  vehicleName: string; startAt: string; endAt: string;
  refund: { refunded: boolean; refundCents: number; refundError?: boolean; policySaysFree?: boolean };
  cancellationWindowHours: number; currency: string;
}): RenderedEmail {
  const { refund } = args;
  const refundLine = refund.refundError
    ? "Your refund is being processed and will land on your card soon."
    : refund.refunded
    ? `Your payment of ${money(refund.refundCents, args.currency)} has been refunded to your card.`
    // policySaysFree true here means the window would have allowed a refund,
    // but it was explicitly denied (an admin override), not a policy outcome.
    : refund.policySaysFree
    ? "Your payment was not refunded for this cancellation."
    : `Cancelled within ${args.cancellationWindowHours} hours of pickup: the deposit is not refunded, as per the cancellation policy.`;
  return {
    subject: `Your ${args.vehicleName} booking was cancelled`,
    html: shell("Booking cancelled", `
      <p>Your booking for the <strong>${args.vehicleName}</strong> (${formatDateTime(args.startAt)} to ${formatDateTime(args.endAt)}) has been cancelled.</p>
      <p>${refundLine}</p>`),
  };
}

export function bookingExtendedEmail(args: {
  vehicleName: string; newEndAt: string; deltaCents: number; currency: string; checkoutUrl: string | null;
}): RenderedEmail {
  // Three outcomes: pay-by-link (a Stripe link to settle the delta), paid at the
  // desk (nothing owed online), or a zero delta (the longer rental cost no more).
  const payLine = args.checkoutUrl
    ? `To lock in the extra time, pay securely here: <a href="${args.checkoutUrl}" style="color:${BRAND}">Pay ${money(args.deltaCents, args.currency)}</a>`
    : args.deltaCents > 0
    ? `The extra ${money(args.deltaCents, args.currency)} was paid at the desk. Nothing more to do.`
    : "There is nothing extra to pay for the added time. Enjoy the road.";
  return {
    subject: `Your ${args.vehicleName} rental is extended`,
    html: shell("Rental extended", `
      <p>Good news, we pushed your return out.</p>
      <p><strong>${args.vehicleName}</strong><br>Now yours until ${formatDateTime(args.newEndAt)}</p>
      <p>${payLine}</p>`),
  };
}

export function adminNewBookingEmail(args: { vehicleName: string; startAt: string; endAt: string; customerEmail: string; paymentOption: string }): RenderedEmail {
  return {
    subject: `New booking: ${args.vehicleName} (${formatDateTime(args.startAt)})`,
    html: shell("New booking", `
      <p>A new booking just came in.</p>
      <p><strong>${args.vehicleName}</strong><br>${formatDateTime(args.startAt)} to ${formatDateTime(args.endAt)}<br>Customer ${args.customerEmail}<br>Payment ${args.paymentOption.replace(/_/g, " ")}</p>`),
  };
}

export function adminPaymentEmail(args: { vehicleName: string; startAt: string; endAt: string; amountCents: number; currency: string; customerEmail: string }): RenderedEmail {
  return {
    subject: `Payment received: ${money(args.amountCents, args.currency)}`,
    html: shell("Payment received", `
      <p>Payment confirmed and the booking is now confirmed.</p>
      <p><strong>${args.vehicleName}</strong><br>${formatDateTime(args.startAt)} to ${formatDateTime(args.endAt)}<br>${money(args.amountCents, args.currency)} from ${args.customerEmail}</p>`),
  };
}

/** Owner copy for a desk-mode confirm (no online payment): the counterpart to
 *  adminPaymentEmail for bookings where nothing was charged online. Sent from
 *  notifyBookingConfirmed's `!paid` branch, so it covers every desk confirm
 *  origin (Telegram tap, email link, admin button) through that one funnel. */
export function adminReservationConfirmedEmail(args: {
  vehicleName: string; startAt: string; endAt: string; rentalTotalCents: number; currency: string; customerEmail: string;
}): RenderedEmail {
  return {
    subject: `Reservation confirmed: ${args.vehicleName}`,
    html: shell("Reservation confirmed", `
      <p>A desk reservation is now confirmed. No online payment was taken. The customer pays at pickup.</p>
      <p><strong>${args.vehicleName}</strong><br>${formatDateTime(args.startAt)} to ${formatDateTime(args.endAt)}<br>${money(args.rentalTotalCents, args.currency)} rental total from ${args.customerEmail}</p>`),
  };
}

export function passwordResetEmail(url: string): RenderedEmail {
  return {
    subject: "Reset your Tex Cars admin password",
    html: shell("Reset your password", `
      <p>Someone asked to reset the password for this admin account.</p>
      <p><a href="${url}" style="color:${BRAND}">Choose a new password</a> (the link works for 30 minutes and can be used once).</p>
      <p style="color:#828aa6;font-size:13px">If this was not you, you can ignore this email. Your password stays as it is.</p>`),
  };
}

export function approvalDecisionEmail(args: {
  siteName: string; messageText: string; approveUrl: string; declineUrl: string;
}): RenderedEmail {
  const lines = args.messageText.split("\n").map((l) => `${l}<br>`).join("");
  return {
    subject: `Booking to confirm at ${args.siteName}`,
    html: shell("Booking to confirm", `
      <p>A new booking came in and is waiting for a quick yes or no.</p>
      <p>${lines}</p>
      <p>
        <a href="${args.approveUrl}" style="display:inline-block;padding:10px 18px;background:#16a34a;color:#fff;border-radius:6px;text-decoration:none;margin-right:8px">Review and confirm</a>
        <a href="${args.declineUrl}" style="display:inline-block;padding:10px 18px;background:#dc2626;color:#fff;border-radius:6px;text-decoration:none">Review and decline</a>
      </p>
      <p>The buttons open a small review page first, so nothing happens by accident. If the booking was already handled you will see who did it.</p>`),
  };
}

export function adminDocumentExpiringEmail(args: {
  vehicleName: string; plate: string; kind: "insurance" | "inspection"; dueOn: string; daysLeft: number;
}): RenderedEmail {
  const doc = args.kind === "insurance" ? "Insurance" : "Inspection";
  const overdue = args.daysLeft < 0;
  const when = overdue
    ? `was due on ${args.dueOn} and is now overdue`
    : args.daysLeft === 0
      ? `is due today (${args.dueOn})`
      : `is due in ${args.daysLeft} ${args.daysLeft === 1 ? "day" : "days"} (${args.dueOn})`;
  return {
    subject: overdue
      ? `${doc} overdue: ${args.vehicleName} (${args.plate})`
      : `${doc} due soon: ${args.vehicleName} (${args.plate})`,
    html: shell(overdue ? `${doc} overdue` : `${doc} due soon`, `
      <p>The ${doc.toLowerCase()} for <strong>${args.vehicleName}</strong> (${args.plate}) ${when}.</p>
      <p>Once it is renewed, enter the new date in Fleet and the reminders reset for the next cycle.</p>`),
  };
}

export function bookingPickedUpEmail(args: {
  vehicleName: string; periodStart: string; periodEnd: string;
  balanceDueCents: number; borgReceivedCents: number | null; currency: string;
}): RenderedEmail {
  const balanceLine = args.balanceDueCents > 0
    ? `<br>Still open: <strong>${money(args.balanceDueCents, args.currency)}</strong>`
    : "";
  const borgLine = args.borgReceivedCents
    ? `<br>Security deposit received: ${money(args.borgReceivedCents, args.currency)} (refundable at return)`
    : "";
  return {
    subject: `You are on the road: ${args.vehicleName}`,
    html: shell("Enjoy the ride", `
      <p>Your ${args.vehicleName} is checked out and ready. Your signed rental contract is attached to this email.</p>
      <p><strong>${args.vehicleName}</strong><br>${args.periodStart} to ${args.periodEnd}${balanceLine}${borgLine}</p>
      <p>Questions during your rental? Just reply here or message us on WhatsApp.</p>`),
  };
}

export function bookingReturnSummaryEmail(args: {
  vehicleName: string; returnedAt: string; newDamage: boolean;
  borgReturnedCents: number | null; borgWithheldCents: number | null;
  borgWithheldReason: string | null; currency: string;
}): RenderedEmail {
  const damagePara = args.newDamage
    ? `<p>We noted new damage at return and documented it with photos. Our team will be in touch if anything more is needed.</p>`
    : `<p>The car came back in great shape. Thank you for taking care of it.</p>`;
  const borgPara = args.borgReturnedCents !== null || args.borgWithheldCents !== null
    ? `<p>Security deposit: <strong>${money(args.borgReturnedCents ?? 0, args.currency)}</strong> returned${
        args.borgWithheldCents
          ? `, ${money(args.borgWithheldCents, args.currency)} withheld (${args.borgWithheldReason ?? "see notes"})`
          : ""
      }.</p>`
    : "";
  return {
    subject: `Thanks for riding with us: ${args.vehicleName} returned`,
    html: shell("Rental completed", `
      <p>Your ${args.vehicleName} was returned on ${args.returnedAt}.</p>
      ${damagePara}
      ${borgPara}
      <p>We would love to see you again next trip.</p>`),
  };
}
