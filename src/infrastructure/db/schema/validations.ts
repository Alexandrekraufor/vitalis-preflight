import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { ObservationInterpretation } from "@/domain/observations/observation-facts";

import { findingSeverityEnum, findingSourceEnum, guideDecisionEnum } from "./enums";
import { guideVersions, guides } from "./guides";

/**
 * One execution of the rule engine.
 *
 * The rule version *and* the file hash are both stored: the version says which
 * contract was in force, the hash proves the file had not been edited since.
 */
export const validationRuns = pgTable(
  "validation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    idGuia: text("id_guia")
      .notNull()
      .references(() => guides.idGuia, { onDelete: "cascade" }),
    guideVersionId: uuid("guide_version_id")
      .notNull()
      .references(() => guideVersions.id, { onDelete: "cascade" }),
    rulesVersion: text("rules_version").notNull(),
    rulesHash: text("rules_hash").notNull(),
    decision: guideDecisionEnum("decision").notNull(),
    decisionSummary: text("decision_summary").notNull(),
    amountAtRisk: numeric("amount_at_risk", { precision: 12, scale: 2 }).notNull(),
    /** `null` when the guide carried no reception note. */
    observationInterpreter: text("observation_interpreter"),
    observationModel: text("observation_model"),
    observationInterpretation: jsonb("observation_interpretation")
      .$type<ObservationInterpretation>(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("validation_runs_guide_idx").on(table.idGuia),
    index("validation_runs_decision_idx").on(table.decision),
    index("validation_runs_completed_at_idx").on(table.completedAt),
  ],
);

export const validationFindings = pgTable(
  "validation_findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    validationRunId: uuid("validation_run_id")
      .notNull()
      .references(() => validationRuns.id, { onDelete: "cascade" }),
    /** Preserves the order the engine produced, which is the reading order. */
    position: integer("position").notNull(),
    code: text("code").notNull(),
    severity: findingSeverityEnum("severity").notNull(),
    source: findingSourceEnum("source").notNull(),
    field: text("field"),
    message: text("message").notNull(),
    expected: text("expected"),
    actual: text("actual"),
    evidence: text("evidence"),
    recommendedAction: text("recommended_action"),
  },
  (table) => [
    index("validation_findings_run_idx").on(table.validationRunId),
    index("validation_findings_code_idx").on(table.code),
  ],
);

export const validationRunsRelations = relations(validationRuns, ({ one, many }) => ({
  guide: one(guides, { fields: [validationRuns.idGuia], references: [guides.idGuia] }),
  guideVersion: one(guideVersions, {
    fields: [validationRuns.guideVersionId],
    references: [guideVersions.id],
  }),
  findings: many(validationFindings),
}));

export const validationFindingsRelations = relations(validationFindings, ({ one }) => ({
  run: one(validationRuns, {
    fields: [validationFindings.validationRunId],
    references: [validationRuns.id],
  }),
}));
