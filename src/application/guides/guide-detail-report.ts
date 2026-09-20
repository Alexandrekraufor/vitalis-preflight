import { z } from "zod";

import { GUIDE_STATUSES, guideStatusLabel } from "@/domain/guides/guide-status";
import { explainDecision, recommendedActions } from "@/domain/guides/validation-result";
import { toGuideRecord } from "@/domain/guides/guide";
import { toDecimalString } from "@/lib/money";

import type { GuideDetail } from "../ports/guide-repository.port";

import {
  findingReportSchema,
  normalizationReportSchema,
  toFindingReport,
} from "./validation-report";

/**
 * A stored guide as the detail screen, `GET /api/v1/guides/{id}` and the MCP
 * `consultar_guia` tool publish it.
 *
 * Everything here is read back from the database — the decision, its summary
 * and the rule stamp are the ones recorded at validation time, not recomputed.
 * That is what makes an old decision still explainable after the rules change.
 */
export const guideDetailReportSchema = z.object({
  guide: z.record(z.string(), z.string().nullable()),
  status: z.enum(GUIDE_STATUSES),
  statusLabel: z.string(),
  canSubmit: z.boolean(),
  amountAtRisk: z.number(),
  summary: z.string(),
  whyItFell: z.array(z.string()),
  findings: z.array(findingReportSchema),
  recommendedActions: z.array(z.string()),
  normalizations: z.array(normalizationReportSchema),
  observation: z
    .object({ interpreter: z.string(), model: z.string().nullable() })
    .nullable(),
  rules: z.object({ version: z.string(), hash: z.string() }),
  validatedAt: z.string(),
  history: z.array(
    z.object({
      id: z.string(),
      status: z.enum(GUIDE_STATUSES),
      summary: z.string(),
      versionNumber: z.number(),
      rulesVersion: z.string(),
      amountAtRisk: z.number(),
      completedAt: z.string(),
    }),
  ),
});

export type GuideDetailReport = z.infer<typeof guideDetailReportSchema>;

export function toGuideDetailReport(detail: GuideDetail): GuideDetailReport {
  const { latestRun } = detail;

  return {
    guide: toGuideRecord(detail.guide),
    status: latestRun.decision,
    statusLabel: guideStatusLabel(latestRun.decision),
    canSubmit: latestRun.decision === "READY_TO_SUBMIT",
    amountAtRisk: Number(toDecimalString(latestRun.amountAtRisk)),
    summary: latestRun.decisionSummary,
    whyItFell: [...explainDecision(detail.findings)],
    findings: detail.findings.map(toFindingReport),
    recommendedActions: [...recommendedActions(detail.findings)],
    normalizations: detail.normalizations.map((change) => ({
      field: change.field,
      kind: change.kind,
      from: change.from,
      to: change.to,
      reason: change.reason,
    })),
    observation:
      latestRun.observationInterpreter === null
        ? null
        : {
            interpreter: latestRun.observationInterpreter,
            model: latestRun.observationModel,
          },
    rules: { version: latestRun.rulesVersion, hash: latestRun.rulesHash },
    validatedAt: latestRun.completedAt.toISOString(),
    history: detail.history.map((run) => ({
      id: run.id,
      status: run.decision,
      summary: run.decisionSummary,
      versionNumber: run.versionNumber,
      rulesVersion: run.rulesVersion,
      amountAtRisk: Number(toDecimalString(run.amountAtRisk)),
      completedAt: run.completedAt.toISOString(),
    })),
  };
}
