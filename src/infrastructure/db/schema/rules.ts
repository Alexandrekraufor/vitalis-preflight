import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import type { RuleDocumentJson } from "@/domain/conventions/rule-document";

import { users } from "./access";
import { ruleSetStatusEnum } from "./enums";

/**
 * Versioned rule sets.
 *
 * A published version is never edited: editing produces a draft, publishing
 * promotes it and archives the previous one. Every decision already carries the
 * version and the hash it ran under, so the history stays reproducible instead
 * of drifting every time somebody adds a plan.
 */
export const ruleSets = pgTable(
  "rule_sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    version: text("version").notNull(),
    status: ruleSetStatusEnum("status").notNull().default("DRAFT"),
    document: jsonb("document").$type<RuleDocumentJson>().notNull(),
    hash: text("hash").notNull(),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: uuid("published_by").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    // One published set and one draft at a time, enforced by the database
    // rather than by whoever remembers to check first.
    // Written as raw SQL because a bound parameter cannot appear in DDL.
    uniqueIndex("rule_sets_single_published")
      .on(table.status)
      .where(sql`${table.status} = 'PUBLISHED'`),
    uniqueIndex("rule_sets_single_draft")
      .on(table.status)
      .where(sql`${table.status} = 'DRAFT'`),
    index("rule_sets_created_idx").on(table.createdAt),
  ],
);
