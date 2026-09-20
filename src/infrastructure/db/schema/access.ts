import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { ApiScope } from "@/domain/access/api-credential";

import {
  apiSurfaceEnum,
  auditActionEnum,
  invitationStatusEnum,
  userRoleEnum,
  userStatusEnum,
} from "./enums";

/**
 * People who can sign in.
 *
 * There is no public registration: a row only appears here when a valid
 * invitation is accepted, or through the documented bootstrap script.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Lower-cased and trimmed before it reaches the database. */
    email: text("email").notNull(),
    name: text("name").notNull(),
    /** argon2id digest. Never leaves the server, never reaches a response. */
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("MEMBER"),
    status: userStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (table) => [
    // Uniqueness is a database constraint, not an application check: two
    // concurrent invitation accepts for the same address must not both win.
    uniqueIndex("users_email_unique").on(table.email),
  ],
);

/**
 * Opaque server-side sessions.
 *
 * The cookie carries a random token; only its SHA-256 digest is stored, so a
 * dump of this table cannot be replayed as a login.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

/**
 * One-time invitations - the only way to create an account.
 *
 * Like sessions, the token is stored hashed: an administrator with database
 * access cannot recover a pending invitation link and use it themselves.
 */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    role: userRoleEnum("role").notNull(),
    tokenHash: text("token_hash").notNull(),
    status: invitationStatusEnum("status").notNull().default("PENDING"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("invitations_token_hash_unique").on(table.tokenHash),
    index("invitations_email_idx").on(table.email),
    index("invitations_status_idx").on(table.status),
  ],
);

/**
 * Trail of sensitive actions.
 *
 * `metadata` holds identifiers and decisions only - never a token, a password,
 * a session value or an authorization header.
 */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    action: auditActionEnum("action").notNull(),
    /** `null` for anonymous or machine actors (external API, MCP). */
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** How the actor reached the system: SESSION, API_KEY, MCP or SYSTEM. */
    actorKind: text("actor_kind").notNull(),
    /** Free-form subject of the action: a guide id, an email, an invitation id. */
    subject: text("subject"),
    metadata: jsonb("metadata").$type<Record<string, string | number | boolean>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_created_at_idx").on(table.createdAt),
    index("audit_events_action_idx").on(table.action),
    index("audit_events_actor_idx").on(table.actorUserId),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  invitationsCreated: many(invitations),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  createdByUser: one(users, {
    fields: [invitations.createdBy],
    references: [users.id],
  }),
}));

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  actor: one(users, { fields: [auditEvents.actorUserId], references: [users.id] }),
}));

/**
 * Bearer credentials issued from the application.
 *
 * Only the digest is stored, so this table cannot be replayed as access - the
 * same rule as `sessions` and `invitations`. `hint` holds the first characters
 * of the secret so two keys can be told apart on screen without revealing
 * either one.
 */
export const apiCredentials = pgTable(
  "api_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    surface: apiSurfaceEnum("surface").notNull(),
    /** What this key may do: READ, WRITE, or both. */
    scopes: text("scopes").array().$type<ApiScope[]>().notNull().default(["READ"]),
    tokenHash: text("token_hash").notNull(),
    hint: text("hint").notNull(),
    /**
     * Only ever set for the credential the evaluation user reads from the
     * panel. Every other key keeps its digest and nothing else: this column is
     * the deliberate, documented exception, not the rule.
     */
    evaluationSecret: text("evaluation_secret"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("api_credentials_token_hash_unique").on(table.tokenHash),
    index("api_credentials_surface_idx").on(table.surface),
  ],
);

export const apiCredentialsRelations = relations(apiCredentials, ({ one }) => ({
  issuer: one(users, { fields: [apiCredentials.createdBy], references: [users.id] }),
}));
