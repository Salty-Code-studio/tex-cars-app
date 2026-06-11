export const dynamic = "force-dynamic";

export default function ConfirmationPage() {
  return (
    <div className="wrap confirm">
      <div className="big">🚗</div>
      <h1>Your car is reserved</h1>
      <p>We&apos;ve held your booking and emailed a confirmation is coming soon. Our team will be in
        touch on WhatsApp to arrange delivery and finalise payment.</p>
      <p className="note">Booking status: <strong>pending</strong>. Online card payment arrives in the next release;
        for now we confirm with you directly.</p>
      <p style={{ marginTop: "2rem" }}><a href="https://tex-cars.com">← Back to tex-cars.com</a></p>
    </div>
  );
}
