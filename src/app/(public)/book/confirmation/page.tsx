"use client";

import { useEffect, useState } from "react";

const RESERVE_MODE = process.env.NEXT_PUBLIC_PAYMENT_MODE === "reserve";

interface Booking { id: string; status: string; startDate: string; endDate: string }

export default function ConfirmationPage() {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) { setLoading(false); return; }
    let tries = 0;
    const poll = () => {
      fetch(`/api/bookings/${id}`).then((r) => (r.ok ? r.json() : null)).then((b: Booking | null) => {
        setBooking(b);
        setLoading(false);
        // the webhook may land a beat after the redirect; poll briefly for "confirmed"
        if (b && b.status === "pending" && tries < 5) { tries++; setTimeout(poll, 1500); }
      }).catch(() => setLoading(false));
    };
    poll();
  }, []);

  const confirmed = booking?.status === "confirmed";

  return (
    <div className="wrap confirm">
      <div className="big">{confirmed ? "✅" : "🚗"}</div>
      <h1>{confirmed ? "Booking confirmed" : "Your car is reserved"}</h1>
      {loading ? (
        <p className="note">Checking your booking…</p>
      ) : !booking ? (
        <p>We&apos;ve received your request. Our team will be in touch shortly.</p>
      ) : confirmed ? (
        RESERVE_MODE ? (
          <p>Reservation confirmed. See you at pickup!</p>
        ) : (
          <p>Payment received and your booking for {booking.startDate} to {booking.endDate} is confirmed.
            We&apos;ll arrange delivery on WhatsApp. See you soon!</p>
        )
      ) : RESERVE_MODE ? (
        <p>Reservation received! Tex Cars will confirm your reservation shortly. You pay the deposit at pickup.</p>
      ) : (
        <p>Your booking for {booking.startDate} to {booking.endDate} is held. If you just paid, the
          confirmation lands in a moment. Our team will also reach out on WhatsApp.</p>
      )}
      <p style={{ marginTop: "2rem" }}><a href="https://tex-cars.com">← Back to tex-cars.com</a></p>
    </div>
  );
}
