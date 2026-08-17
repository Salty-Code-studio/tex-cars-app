"use client";

import { useEffect, useState } from "react";
import { apiGet, api, type ApiError } from "../../client";

interface TeamUser {
  id: string;
  email: string;
  role: string;
  mfaEnabled: boolean;
  createdAt: string;
}

export default function TeamPage() {
  const [users, setUsers] = useState<TeamUser[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      const { users } = await apiGet<{ users: TeamUser[] }>("/api/admin/users");
      setUsers(users);
    } catch (err) {
      setMsg((err as ApiError).message);
    }
  }
  useEffect(() => { void load(); }, []);

  async function generateLink(id: string) {
    setMsg("");
    setBusyId(id);
    try {
      const { url } = await api<{ url: string }>(`/api/admin/users/${id}/reset-link`);
      setLink(url);
      setCopied(false);
    } catch (err) {
      setMsg((err as ApiError).message);
    } finally {
      setBusyId(null);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  const dateFmt = (iso: string) => new Date(iso).toLocaleDateString();

  if (!users) return <p className="muted">Loading…</p>;

  return (
    <>
      <h1>Team</h1>
      <p className="sub">Everyone with access to this dashboard, and their two-step status.</p>

      <div className="panel">
        <table className="grid">
          <thead>
            <tr><th>Email</th><th>Role</th><th>Two-step</th><th>Added</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td><span className={`tag ${u.mfaEnabled ? "on" : "off"}`}>{u.mfaEnabled ? "On" : "Off"}</span></td>
                <td>{dateFmt(u.createdAt)}</td>
                <td>
                  <div className="row-actions">
                    <button onClick={() => generateLink(u.id)} disabled={busyId === u.id}>
                      {busyId === u.id ? "Generating…" : "Generate reset link"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="msg err" role="alert">{msg}</p>
      </div>

      {link && (
        <div className="panel">
          <h2>Reset link</h2>
          <div className="link-row">
            <input readOnly value={link} onFocus={(e) => e.target.select()} />
            <button type="button" className="btn btn--quiet" onClick={copyLink}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <p className="muted">Share this link with them directly, it works once and expires in 30 minutes.</p>
        </div>
      )}
    </>
  );
}
