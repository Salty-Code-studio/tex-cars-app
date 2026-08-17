"use client";

import { useState, type FormEvent } from "react";
import { api, type ApiError } from "../../client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      // The endpoint always answers 200 whether or not the account exists
      // (anti-enumeration), so a successful call just means the request went
      // through, not that an email is guaranteed.
      await api("/api/admin/auth/reset/request", { email });
      setSent(true);
      setBusy(false);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(
        apiErr.status === 429
          ? `Too many attempts. Try again in ${apiErr.retryAfter ?? "a few"} seconds.`
          : "Something went wrong. Please try again.",
      );
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="auth-card">
        <h1>Check your email</h1>
        <p className="sub">
          If that account exists, a reset link is on its way. No email after
          a few minutes? Ask the owner to generate a link for you.
        </p>
        <p className="auth-alt"><a href="/admin/login">Back to sign in</a></p>
      </div>
    );
  }

  return (
    <form className="auth-card" onSubmit={onSubmit}>
      <h1>Forgot your password?</h1>
      <p className="sub">Enter your email and we will send you a reset link.</p>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="username" required
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <button className="btn" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
      <p className="msg err" role="alert">{error}</p>
      <p className="auth-alt"><a href="/admin/login">Back to sign in</a></p>
    </form>
  );
}
