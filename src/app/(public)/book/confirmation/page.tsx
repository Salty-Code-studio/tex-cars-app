"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/time/format";
import { siteConfig } from "@/lib/site-config";
import type { QuoteBreakdown } from "@/lib/booking/quote";
import "./confirmation.css";

const DESK_MODE = process.env.NEXT_PUBLIC_PAYMENT_MODE === "desk";

interface Booking {
  id: string;
  status: string;
  startAt: string;
  endAt: string;
  amountPaidCents?: number;
  priceBreakdown?: Partial<QuoteBreakdown> | null;
  vehicleClass?: string | null;
  vehicleName?: string | null;
}

// Same key book/page.tsx persists the in-progress wizard draft under
// (WIZARD_STORAGE_KEY there, not exported). This page is where a booking is
// done cooking, so it retires that draft on mount.
const WIZARD_STORAGE_KEY = "book-wizard-v1";

// The webhook that flips a booking to "confirmed" can land well after the
// Stripe redirect. Rather than give up after a few seconds, poll with
// backoff: 4 quick pings, then 6 a bit slower, then 7 patient ones
// (~59.5s total) before handing control to the "Check again" button.
// Desk mode has no webhook (a manager confirms via Telegram, email, or the
// admin Confirm button, see the DESK_MODE pending branch below), but polling
// still harmlessly picks up a confirm that happens to land while this page
// is open.
const BACKOFF_MS = [
  ...Array(4).fill(1500),
  ...Array(6).fill(3000),
  ...Array(7).fill(5000),
];

const money = (cents: number, currency = "USD") =>
  currency === "USD" ? `$${(cents / 100).toFixed(2)}` : `${currency} ${(cents / 100).toFixed(2)}`;

/** Short human reference derived from the booking id - same derivation the
 *  rental contract PDF already uses (src/lib/admin/inspections.ts's
 *  contractRef), so the number on paper and the number on screen match. */
const reference = (id: string) => id.slice(0, 8).toUpperCase();

interface Step {
  title: string;
  body: string;
}

/** Pending: a slow breathing ring in cobalt. Deliberately NOT a spinner -
 *  scale + opacity only, no rotation - and reduced-motion turns the pulse off
 *  in the CSS, leaving a plain static ring. */
function RingMark() {
  return (
    <div className="conf-mark" aria-hidden="true">
      <div className="conf-ring-pulse" />
      <div className="conf-ring-core">
        <div className="conf-ring-dot" />
      </div>
    </div>
  );
}

/** Confirmed: a hand-drawn checkmark in coral, pure CSS/SVG (stroke-dashoffset
 *  animation, disabled under reduced motion in the CSS). */
function CheckMark() {
  return (
    <div className="conf-mark" aria-hidden="true">
      <svg viewBox="0 0 72 72" width="72" height="72">
        <circle className="conf-check-ring" cx="36" cy="36" r="33" />
        <path className="conf-check-path" d="M20 38 L30 48 L52 24" />
      </svg>
    </div>
  );
}

/** Small static check used inside step 1's badge once confirmed. */
function StepCheck() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M5 13 L9.5 17.5 L19 6.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ConfirmationPage() {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // The wizard's persisted draft has done its job by the time this page
    // mounts (the booking exists, paid or not) — clear it so a later /book
    // visit never resurrects a stale, already-placed booking.
    try { window.sessionStorage.removeItem(WIZARD_STORAGE_KEY); } catch { /* storage unavailable — nothing to clear */ }

    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) { setLoading(false); return; }

    let cancelled = false;
    let tries = 0;

    const poll = () => {
      fetch(`/api/bookings/${id}`).then((r) => (r.ok ? r.json() : null)).then((b: Booking | null) => {
        if (cancelled) return;
        setBooking(b);
        setLoading(false);
        if (b && b.status === "pending" && tries < BACKOFF_MS.length) {
          setPolling(true);
          const delay = BACKOFF_MS[tries] ?? 5000;
          tries++;
          setTimeout(poll, delay);
        } else {
          setPolling(false);
          // Ran out of patience while still pending: hand off to "Check again".
          if (b && b.status === "pending") setExhausted(true);
        }
      }).catch(() => {
        if (cancelled) return;
        setLoading(false);
        setPolling(false);
        setExhausted(true);
      });
    };
    poll();
    return () => { cancelled = true; };
  }, []);

  function checkAgain() {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id || checking) return;
    setChecking(true);
    fetch(`/api/bookings/${id}`).then((r) => (r.ok ? r.json() : null)).then((b: Booking | null) => {
      if (b) setBooking(b);
    }).catch(() => { /* stay on the exhausted state; the customer can try again */ }).finally(() => setChecking(false));
  }

  const confirmed = booking?.status === "confirmed";
  const notFound = !loading && !booking;

  function subText(): string {
    if (notFound) return "If you just booked, check your email, or message us on WhatsApp and we will help.";
    if (!booking) return "Checking your booking.";
    if (confirmed) {
      return DESK_MODE
        ? "Your reservation is confirmed. See you at pickup."
        : "Payment received. Your booking is confirmed.";
    }
    return DESK_MODE
      ? "Your booking is in. Our team is confirming it now."
      : "Your booking is held. If you already paid, this confirms in a moment.";
  }

  function stepsFor(): Step[] {
    if (DESK_MODE) {
      return [
        {
          title: "We confirm by email",
          body: confirmed
            ? "Confirmed. Check your inbox for the confirmation email."
            : "Our team reviews every booking. You will get an email the moment it is confirmed.",
        },
        { title: "Questions? WhatsApp us", body: "Message us any time on WhatsApp and we will get right back to you." },
        { title: "Pay at pickup", body: "Bring your license and pay at the desk when you collect the car." },
      ];
    }
    return [
      {
        title: "We confirm your payment",
        body: confirmed
          ? "Confirmed. Check your inbox for the confirmation email."
          : "We are finalizing your payment. You will get an email as soon as it clears.",
      },
      { title: "Questions? WhatsApp us", body: "Message us any time on WhatsApp and we will get right back to you." },
      { title: "We arrange delivery", body: "We will reach out on WhatsApp to arrange delivery of your car." },
    ];
  }

  const heading = confirmed ? "You're booked" : notFound ? "We could not find that booking" : "Almost there";

  // Price rows: desk mode never shows payment language (no online charge
  // exists to report); the confirmed+non-desk branch alone keeps the original
  // "Payment received: $X" fact, now as a row instead of a loose paragraph.
  const bd = booking?.priceBreakdown;
  const hasTotal = typeof bd?.subtotalCents === "number";
  const totalCents = hasTotal ? bd!.subtotalCents! : 0;
  const youngDriverCents = typeof bd?.youngDriverCents === "number" ? bd.youngDriverCents : 0;
  const baseRentalCents = totalCents - youngDriverCents;
  const currency = bd?.currency ?? "USD";
  const depositCents = typeof bd?.depositCents === "number" ? bd.depositCents : null;
  const paidCents = booking?.amountPaidCents;

  return (
    <div className="wrap conf-page">
      <div className="conf-hero">
        {loading || (booking && !confirmed) ? <RingMark /> : null}
        {confirmed ? <CheckMark /> : null}
        <h1 className="conf-h1">{heading}</h1>
        <div aria-live="polite">
          <p className="conf-sub">{subText()}</p>
          {booking && !confirmed ? (
            polling ? (
              <p className="conf-status">Checking for an update…</p>
            ) : exhausted ? (
              <div className="conf-recheck">
                <p className="conf-status">This is taking a little longer than usual.</p>
                <button type="button" className="btn btn-quiet" onClick={checkAgain} disabled={checking}>
                  {checking ? "Checking…" : "Check again"}
                </button>
              </div>
            ) : null
          ) : null}
        </div>
      </div>

      {booking && (
        <dl className="conf-card" aria-label="Reservation summary">
          <div className="conf-card-head">Reservation summary</div>
          {booking.vehicleClass && (
            <div className="conf-row"><dt>Class</dt><dd>{booking.vehicleClass}</dd></div>
          )}
          {booking.vehicleName && (
            <div className="conf-row"><dt>Car</dt><dd>{booking.vehicleName}</dd></div>
          )}
          <div className="conf-row"><dt>Pickup</dt><dd>{formatDateTime(booking.startAt)}</dd></div>
          <div className="conf-row"><dt>Return</dt><dd>{formatDateTime(booking.endAt)}</dd></div>
          {hasTotal && (
            <div className="conf-row"><dt>Rental</dt><dd>{money(baseRentalCents, currency)}</dd></div>
          )}
          {youngDriverCents > 0 && (
            <div className="conf-row"><dt>Young driver</dt><dd>{money(youngDriverCents, currency)}</dd></div>
          )}
          {hasTotal && (
            <div className="conf-row conf-row--total"><dt>Total</dt><dd>{money(totalCents, currency)}</dd></div>
          )}
          {DESK_MODE && depositCents !== null && (
            <div className="conf-row"><dt>Refundable deposit</dt><dd>{money(depositCents, currency)}</dd></div>
          )}
          {!DESK_MODE && confirmed && typeof paidCents === "number" && paidCents > 0 && (
            <div className="conf-row"><dt>Paid</dt><dd>{money(paidCents, currency)}</dd></div>
          )}
          <div className="conf-row conf-row--ref"><dt>Reference</dt><dd>{reference(booking.id)}</dd></div>
        </dl>
      )}

      {booking && (
        <div className="conf-steps">
          <p className="conf-steps-head">What happens next</p>
          <ol className="conf-steps-list">
            {stepsFor().map((step, i) => {
              const done = i === 0 && confirmed;
              return (
                <li className="conf-step" key={step.title}>
                  <span className={done ? "step-n conf-step-done" : "step-n"}>
                    {done ? <StepCheck /> : i + 1}
                  </span>
                  <div>
                    <p className="conf-step-title">{step.title}</p>
                    <p className="conf-step-body">{step.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {!loading && siteConfig.whatsappHref && (
        <a href={siteConfig.whatsappHref} target="_blank" rel="noreferrer" className="btn conf-cta">
          Message us on WhatsApp
        </a>
      )}

      <p className="conf-footer">
        <a href={siteConfig.siteUrl}>← {siteConfig.backLinkLabel}</a>
      </p>
    </div>
  );
}
