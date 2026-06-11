import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/env";
import { memoryStore as db, type SessionRecord } from "@/lib/auth/memory-store";

/**
 * Opaque, server-side sessions.
 *
 * Design (OWASP Session Management):
 *   - The session ID is high-entropy random (NOT a JWT — server holds all state).
 *   - The cookie value is `<id>.<HMAC(id)>`; the HMAC lets us reject tampered or
 *     forged IDs WITHOUT a DB lookup, and binds the cookie to SESSION_SECRET.
 *   - Sessions are stored server-side with an absolute expiry; we can revoke any
 *     session instantly by deleting it (true logout — unlike a stateless JWT).
 *   - Each session carries a per-session CSRF token (double-submit, see csrf.ts).
 */

const SID_BYTES = 32; // 256 bits of entropy

function sign(value: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(value).digest("base64url");
}

/** Build the signed cookie value from a raw session id. */
function pack(id: string): string {
  return `${id}.${sign(id)}`;
}

/** Verify + extract the raw id from a signed cookie value (constant-time). */
export function unpack(cookieValue: string): string | null {
  const dot = cookieValue.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = cookieValue.slice(0, dot);
  const mac = cookieValue.slice(dot + 1);
  const expected = sign(id);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return id;
}

export interface CreatedSession {
  cookieValue: string; // signed value to set in the session cookie
  csrfToken: string; // to set in the (non-HttpOnly) CSRF cookie
  record: SessionRecord;
}

export function createSession(userId: string): CreatedSession {
  const id = randomBytes(SID_BYTES).toString("base64url");
  const csrfToken = randomBytes(SID_BYTES).toString("base64url");
  const now = Date.now();
  const record: SessionRecord = {
    id,
    userId,
    csrfToken,
    createdAt: now,
    expiresAt: now + env.SESSION_TTL_SECONDS * 1000,
  };
  db.sessions.create(record);
  return { cookieValue: pack(id), csrfToken, record };
}

/** Resolve a signed cookie value to a live session, or null. */
export function resolveSession(cookieValue: string | undefined): SessionRecord | null {
  if (!cookieValue) return null;
  const id = unpack(cookieValue);
  if (!id) return null;
  return db.sessions.get(id) ?? null;
}

export function destroySession(cookieValue: string | undefined): void {
  if (!cookieValue) return;
  const id = unpack(cookieValue);
  if (id) db.sessions.delete(id);
}

export const SESSION_TTL_SECONDS = env.SESSION_TTL_SECONDS;
