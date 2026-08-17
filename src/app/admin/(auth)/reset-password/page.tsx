"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { api, type ApiError } from "../../client";

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [showFreshLink, setShowFreshLink] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setShowFreshLink(false);

    if (password !== repeat) {
      setError("Those passwords do not match.");
      return;
    }
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }

    setBusy(true);
    try {
      await api("/api/admin/auth/reset/confirm", { token, password });
      setDone(true);
      setBusy(false);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message);
      if (apiErr.status === 400) setShowFreshLink(true);
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="auth-card">
        <h1>Password updated</h1>
        <p className="sub">Password updated. Log in with your new password.</p>
        <p className="auth-alt"><a href="/admin/login">Go to sign in</a></p>
      </div>
    );
  }

  return (
    <form className="auth-card" onSubmit={onSubmit}>
      <h1>Set a new password</h1>
      <p className="sub">Choose a new password, at least 12 characters.</p>
      <div className="field">
        <label htmlFor="password">New password</label>
        <input id="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}
          value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="repeat">Repeat password</label>
        <input id="repeat" type="password" autoComplete="new-password" required minLength={12} maxLength={128}
          value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      </div>
      <button className="btn" disabled={busy || !token}>{busy ? "Updating…" : "Update password"}</button>
      <p className="msg err" role="alert">{error}</p>
      {showFreshLink && (
        <p className="auth-alt"><a href="/admin/forgot-password">Request a fresh link</a></p>
      )}
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="auth-card"><p className="sub">Loading…</p></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
