/**
 * @deprecated INTERIM in-memory store inherited from the fort starter.
 *
 * Used ONLY by the interim auth libs (session.ts, csrf.ts, authz.ts) until
 * Plan 02 moves admin/customer auth onto Postgres (admin_users, customers,
 * sessions tables). Nothing persists across restarts and nothing else may
 * import this module. The real data layer is `@/lib/db` (Drizzle).
 */

export interface UserRecord {
  id: string;
  email: string; // stored lowercased
  passwordHash: string; // argon2id hash — never plaintext
  createdAt: string;
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
const sessions = new Map<string, SessionRecord>();

export const memoryStore = {
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
