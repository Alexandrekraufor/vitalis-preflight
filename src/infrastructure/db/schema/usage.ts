import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { apiCredentials, users } from "./access";
import { apiSurfaceEnum, requestOutcomeEnum } from "./enums";
import { oauthClients } from "./oauth";

/**
 * One row per request to a machine-facing surface.
 *
 * It answers the questions an operator actually asks: how much is this API
 * being used, by whom, and what is failing. It records identifiers and
 * outcomes only: no request body, no token, no header, no patient data. The
 * path is the route pattern, so a guide identifier never lands here either.
 */
export const apiRequestEvents = pgTable(
  "api_request_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    surface: apiSurfaceEnum("surface").notNull(),
    method: text("method").notNull(),
    /** Route pattern, never the concrete URL. */
    route: text("route").notNull(),
    status: integer("status").notNull(),
    outcome: requestOutcomeEnum("outcome").notNull(),
    durationMs: integer("duration_ms").notNull(),
    credentialId: uuid("credential_id").references(() => apiCredentials.id, {
      onDelete: "set null",
    }),
    oauthClientId: uuid("oauth_client_id").references(() => oauthClients.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("api_request_events_created_idx").on(table.createdAt),
    index("api_request_events_surface_idx").on(table.surface),
  ],
);
