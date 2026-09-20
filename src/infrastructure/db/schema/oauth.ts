import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { tokenKindEnum } from "./enums";
import { users } from "./access";

/**
 * Clients registered by an MCP client itself, through dynamic registration.
 *
 * There is no secret column: these are public clients that authenticate by
 * proving possession of the PKCE verifier, which is what OAuth 2.1 prescribes
 * for anything that cannot keep a secret, and an MCP client on someone's
 * laptop cannot.
 */
export const oauthClients = pgTable("oauth_clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  redirectUris: jsonb("redirect_uris").$type<string[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A validated authorization request waiting for the person to approve it.
 *
 * Holding it server side means the consent form carries one opaque id instead
 * of the parameters themselves, so nothing a browser posts back can widen the
 * scope, change the redirect target or swap the client.
 */
export const oauthAuthorizationRequests = pgTable(
  "oauth_authorization_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => oauthClients.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    redirectUri: text("redirect_uri").notNull(),
    scope: text("scope").notNull(),
    state: text("state"),
    codeChallenge: text("code_challenge").notNull(),
    resource: text("resource"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("oauth_authorization_requests_expires_idx").on(table.expiresAt)],
);

/**
 * Authorization codes, stored as digests and consumable exactly once.
 *
 * `consumedAt` is set by a conditional update, so two redemptions of the same
 * code cannot both win a token.
 */
export const oauthAuthorizationCodes = pgTable(
  "oauth_authorization_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codeHash: text("code_hash").notNull().unique(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => oauthClients.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    redirectUri: text("redirect_uri").notNull(),
    scope: text("scope").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    resource: text("resource"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("oauth_authorization_codes_expires_idx").on(table.expiresAt)],
);

/** Access and refresh tokens. Only digests are stored, as everywhere else. */
export const oauthTokens = pgTable(
  "oauth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    kind: tokenKindEnum("kind").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => oauthClients.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    resource: text("resource"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("oauth_tokens_user_idx").on(table.userId),
    index("oauth_tokens_expires_idx").on(table.expiresAt),
  ],
);
