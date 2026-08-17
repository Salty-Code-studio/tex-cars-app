import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { adminUsers } from "./admin";

/**
 * Admin password reset tokens. The raw 32-byte token lives only in the reset
 * link; we store sha256(token). Single-use, 30 minute TTL, and issuing a new
 * token invalidates any prior unused ones for the same admin.
 */
export const adminResetTokens = pgTable("admin_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminUserId: uuid("admin_user_id").notNull()
    .references(() => adminUsers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("admin_reset_tokens_admin").on(t.adminUserId)]);
