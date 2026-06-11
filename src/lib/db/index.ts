/**
 * Data layer (in-memory reference implementation).
 *
 * This starter uses an in-memory store so it runs with zero external services.
 * It is intentionally structured to mirror a real database repository so the
 * SECURITY-CRITICAL patterns are visible and easy to port:
 *
 *   1. PARAMETERIZED QUERIES ONLY (OWASP A03:2021 — Injection).
 *      When you swap this for Postgres/MySQL/SQLite, NEVER build SQL by string
 *      concatenation/interpolation with user input. Use placeholders, e.g.:
 *
 *        // node-postgres (pg)
 *        await pool.query(
 *          "SELECT id, owner_id, title FROM notes WHERE id = $1 AND owner_id = $2",
 *          [noteId, userId],
 *        );
 *
 *        // better-sqlite3
 *        db.prepare("SELECT * FROM notes WHERE id = ? AND owner_id = ?").get(noteId, userId);
 *
 *      With an ORM (Prisma/Drizzle), use the typed query builder — it
 *      parameterizes for you. Avoid `$queryRawUnsafe`/raw string SQL.
 *
 *   2. SCOPE READS/WRITES BY OWNER in the query itself (defense-in-depth for
 *      authorization — see authz.ts). We do that below in the notes repo.
 *
 *   3. Store ONLY password HASHES, never plaintext (see lib/auth/password.ts).
 */

export interface UserRecord {
  id: string;
  email: string; // stored lowercased
  passwordHash: string; // argon2id hash — never plaintext
  createdAt: string;
}

export interface NoteRecord {
  id: string;
  ownerId: string; // authorization anchor
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionRecord {
  id: string; // opaque random id (the cookie value, signed separately)
  userId: string;
  csrfToken: string; // per-session CSRF secret (double-submit)
  createdAt: number; // epoch ms
  expiresAt: number; // epoch ms
}

const users = new Map<string, UserRecord>();
const usersByEmail = new Map<string, string>(); // email -> id
const notes = new Map<string, NoteRecord>();
const sessions = new Map<string, SessionRecord>();

export const db = {
  users: {
    findByEmail(email: string): UserRecord | undefined {
      const id = usersByEmail.get(email.toLowerCase());
      return id ? users.get(id) : undefined;
    },
    findById(id: string): UserRecord | undefined {
      return users.get(id);
    },
    create(record: UserRecord): UserRecord {
      users.set(record.id, record);
      usersByEmail.set(record.email.toLowerCase(), record.id);
      return record;
    },
  },

  notes: {
    /** Always pass ownerId so authorization is enforced in the query itself. */
    listByOwner(ownerId: string): NoteRecord[] {
      return [...notes.values()]
        .filter((n) => n.ownerId === ownerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    /** Returns undefined if the note doesn't exist OR isn't owned by ownerId. */
    findOwned(id: string, ownerId: string): NoteRecord | undefined {
      const note = notes.get(id);
      if (!note || note.ownerId !== ownerId) return undefined;
      return note;
    },
    create(record: NoteRecord): NoteRecord {
      notes.set(record.id, record);
      return record;
    },
    update(record: NoteRecord): NoteRecord {
      notes.set(record.id, record);
      return record;
    },
    deleteOwned(id: string, ownerId: string): boolean {
      const note = notes.get(id);
      if (!note || note.ownerId !== ownerId) return false;
      return notes.delete(id);
    },
  },

  sessions: {
    get(id: string): SessionRecord | undefined {
      const s = sessions.get(id);
      if (!s) return undefined;
      if (s.expiresAt <= Date.now()) {
        sessions.delete(id);
        return undefined;
      }
      return s;
    },
    create(record: SessionRecord): SessionRecord {
      sessions.set(record.id, record);
      return record;
    },
    delete(id: string): void {
      sessions.delete(id);
    },
  },
};
