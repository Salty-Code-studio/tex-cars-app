"use client";

import { useEffect, useState } from "react";

/** Magic-link landing: ?email&code from the email. Verifies and redirects. */
export default function VerifyPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const email = p.get("email"), code = p.get("code");
    if (!email || !code) { setError("This link is incomplete."); return; }
    fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code }) })
      .then((r) => { if (r.ok) window.location.href = "/account"; else setError("This link is invalid or has expired."); })
      .catch(() => setError("Network error. Please try again."));
  }, []);

  return (
    <div className="wrap" style={{ maxWidth: 440 }}>
      <div className="card">
        <h2>Signing you in…</h2>
        {error ? <p className="msg err">{error} <a href="/account/login">Try again</a></p> : <p className="note">One moment.</p>}
      </div>
    </div>
  );
}
