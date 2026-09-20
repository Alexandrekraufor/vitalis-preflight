import { z } from "zod";

import { GUIDE_STATUSES, guideStatusLabel } from "@/domain/guides/guide-status";
import type { Finding } from "@/domain/rules/finding";
import {
  explainDecision,
  recommendedActions,
  type ValidationResult,
} from "@/domain/guides/validation-result";
import type { NormalizationChange } from "@/domain/normalization/normalization.types";
import { toDecimalString, type Money } from "@/lib/money";

/** Public shape of a single finding, reused wherever findings are published. */
export const findingReportSchema = z.object({
  code: z.string(),
  severity: z.enum(["BLOCKING", "REVIEW", "INFO"]),
  field: z.string().nullable(),
  message: z.string(),
  expected: z.string().nullable(),
  actual: z.string().nullable(),
  source: z.enum(["CONVENTION_RULE", "REFERENCE_TABLE", "RECEPTION_NOTE"]),
  evidence: z.string().nullable(),
  recommendedAction: z.string().nullable(),
});

export type FindingReport = z.infer<typeof findingReportSchema>;

export function toFindingReport(finding: Finding): FindingReport {
  return {
    code: finding.code,
    severity: finding.severity,
    field: finding.field,
    message: finding.message,
    expected: finding.expected,
    actual: finding.actual,
    source: finding.source,
    evidence: finding.evidence,
    recommendedAction: finding.recommendedAction,
  };
}

export const normalizationReportSchema = z.object({
  field: z.string(),
  kind: z.string(),
  from: z.string(),
  to: z.string().nullable(),
  reason: z.string(),
});

/**
 * The public shape of a validation, shared by the REST API and the MCP tools.
 *
 * It is declared as a schema rather than an interface because MCP needs a real
 * schema to publish as its `outputSchema`; the TypeScript type is derived from
 * it, so the documented contract and the compiled one cannot diverge.
 */
export const validationReportSchema = z.object({
  idGuia: z.string(),
  status: z.enum(GUIDE_STATUSES),
  statusLabel: z.string(),
  canSubmit: z.boolean(),
  amountAtRisk: z.number(),
  summary: z.string(),
  findings: z.array(findingReportSchema),
  recommendedActions: z.array(z.string()),
  /** Plain-language reasons, derived from the stored findings only. */
  whyItFell: z.array(z.string()),
  normalizations: z.array(normalizationReportSchema),
  observation: z
    .object({
      interpreter: z.string(),
      model: z.string().nullable(),
      requiresReview: z.boolean(),
      confidence: z.number(),
      facts: z.array(
        z.object({
          type: z.string(),
          evidence: z.string(),
          confidence: z.number(),
        }),
      ),
    })
    .nullable(),
  rules: z.object({ version: z.string(), hash: z.string() }),
});

export type ValidationReport = z.infer<typeof validationReportSchema>;

/** `amountAtRisk` is published in reais, the unit every consumer expects. */
function toReais(amount: Money): number {
  return Number(toDecimalString(amount));
}

export function toValidationReport(
  result: ValidationResult,
  normalizations: readonly NormalizationChange[],
): ValidationReport {
  return {
    idGuia: result.guide.idGuia,
    status: result.decision.status,
    statusLabel: guideStatusLabel(result.decision.status),
    canSubmit: result.decision.canSubmit,
    amountAtRisk: toReais(result.decision.amountAtRisk),
    summary: result.decision.summary,
    findings: result.findings.map(toFindingReport),
    recommendedActions: [...recommendedActions(result.findings)],
    whyItFell: [...explainDecision(result.findings)],
    normalizations: normalizations.map((change) => ({
      field: change.field,
      kind: change.kind,
      from: change.from,
      to: change.to,
      reason: change.reason,
    })),
    observation:
      result.observation === null
        ? null
        : {
            interpreter: result.observation.interpreter,
            model: result.observation.model,
            requiresReview: result.observation.interpretation.requiresReview,
            confidence: result.observation.interpretation.confidence,
            facts: [...result.observation.interpretation.facts],
          },
    rules: result.rules,
  };
}
