import { relations } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type {
  NormalizationChange,
  NormalizedGuideRecord,
  RawGuideRecord,
} from "@/domain/normalization/normalization.types";

import { clinicUnitEnum, importSourceEnum } from "./enums";

/** One upload, API batch or seed run - the provenance of a set of versions. */
export const sourceImports = pgTable("source_imports", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: importSourceEnum("source").notNull(),
  /** Original file name when there was a file. */
  fileName: text("file_name"),
  /** SHA-256 of the uploaded bytes, so the same file is recognizable. */
  fileHash: text("file_hash"),
  rowsRead: integer("rows_read").notNull(),
  rowsImported: integer("rows_imported").notNull(),
  rowsRejected: integer("rows_rejected").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Identity of a guide plus its current normalized values.
 *
 * The normalized fields are duplicated here (they also live inside the version
 * payload) because every list, filter and report reads them; querying JSONB for
 * a unit filter would be both slower and less type-safe.
 */
export const guides = pgTable(
  "guides",
  {
    idGuia: text("id_guia").primaryKey(),
    currentVersionId: uuid("current_version_id").notNull(),
    /**
     * Pointer to the newest validation run. Written in the same transaction as
     * the run itself; it exists so listing hundreds of guides with their current
     * decision is one indexed join instead of a per-row lookup. No foreign key,
     * because guides and validation_runs reference each other.
     */
    latestValidationRunId: uuid("latest_validation_run_id"),
    unit: clinicUnitEnum("unit").notNull(),
    appointmentDate: date("appointment_date").notNull(),
    patient: text("patient").notNull(),
    conventionName: text("convention_name").notNull(),
    procedureCode: text("procedure_code").notNull(),
    procedureDescription: text("procedure_description"),
    professional: text("professional"),
    amount: numeric("amount", { precision: 12, scale: 2 }),
    receptionNote: text("reception_note"),
    enteredAt: date("entered_at"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("guides_unit_idx").on(table.unit),
    index("guides_convention_idx").on(table.conventionName),
    index("guides_appointment_date_idx").on(table.appointmentDate),
  ],
);

/**
 * Every version of a guide we have ever seen, with the bytes exactly as they
 * arrived. Re-importing an unchanged guide adds no version; a changed one adds
 * a version and leaves the previous decision auditable.
 */
export const guideVersions = pgTable(
  "guide_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    idGuia: text("id_guia").notNull(),
    versionNumber: integer("version_number").notNull(),
    /** SHA-256 of the normalized payload; how re-imports are deduplicated. */
    contentHash: text("content_hash").notNull(),
    rawPayload: jsonb("raw_payload").$type<RawGuideRecord>().notNull(),
    normalizedPayload: jsonb("normalized_payload").$type<NormalizedGuideRecord>().notNull(),
    normalizationChanges: jsonb("normalization_changes")
      .$type<readonly NormalizationChange[]>()
      .notNull(),
    sourceImportId: uuid("source_import_id").references(() => sourceImports.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("guide_versions_guide_version_idx").on(table.idGuia, table.versionNumber),
    index("guide_versions_guide_idx").on(table.idGuia),
  ],
);

export const guidesRelations = relations(guides, ({ many, one }) => ({
  versions: many(guideVersions),
  currentVersion: one(guideVersions, {
    fields: [guides.currentVersionId],
    references: [guideVersions.id],
  }),
}));

export const guideVersionsRelations = relations(guideVersions, ({ one }) => ({
  guide: one(guides, { fields: [guideVersions.idGuia], references: [guides.idGuia] }),
  sourceImport: one(sourceImports, {
    fields: [guideVersions.sourceImportId],
    references: [sourceImports.id],
  }),
}));
