import type { ObservationInterpretation } from "@/domain/observations/observation-facts";
import type { Finding } from "@/domain/rules/finding";
import { ZERO, type Money } from "@/lib/money";

import type { GuideStatus } from "./guide-status";
import type { NormalizedGuide } from "./guide.types";

/**
 * The decision, as a discriminated union so `canSubmit` can never disagree with
 * `status`, and so a new status cannot be added without the compiler pointing
 * at every place that has to handle it.
 */
export type GuideDecision =
  | {
      readonly status: "READY_TO_SUBMIT";
      readonly canSubmit: true;
      readonly amountAtRisk: Money;
      readonly summary: string;
    }
  | {
      readonly status: "NEEDS_CORRECTION";
      readonly canSubmit: false;
      readonly amountAtRisk: Money;
      readonly summary: string;
      readonly blockingFindings: readonly Finding[];
    }
  | {
      readonly status: "REVIEW_REQUIRED";
      readonly canSubmit: false;
      readonly amountAtRisk: Money;
      readonly summary: string;
      readonly reviewFindings: readonly Finding[];
    };

/**
 * Anything objectively wrong outranks anything merely uncertain: a guide with
 * both a missing authorization number and an ambiguous note still needs that
 * number typed in before a human argument is worth having.
 */
export function decide(
  guide: NormalizedGuide,
  findings: readonly Finding[],
): GuideDecision {
  const blocking = findings.filter((finding) => finding.severity === "BLOCKING");
  const review = findings.filter((finding) => finding.severity === "REVIEW");
  const amountAtRisk = guide.amount ?? ZERO;

  if (blocking.length > 0) {
    return {
      status: "NEEDS_CORRECTION",
      canSubmit: false,
      amountAtRisk,
      summary: summarize("NEEDS_CORRECTION", blocking),
      blockingFindings: blocking,
    };
  }

  if (review.length > 0) {
    return {
      status: "REVIEW_REQUIRED",
      canSubmit: false,
      amountAtRisk,
      summary: summarize("REVIEW_REQUIRED", review),
      reviewFindings: review,
    };
  }

  return {
    status: "READY_TO_SUBMIT",
    canSubmit: true,
    amountAtRisk: ZERO,
    summary: "Nenhum problema encontrado nas regras vigentes.",
  };
}

function summarize(status: GuideStatus, findings: readonly Finding[]): string {
  const first = findings[0];
  if (first === undefined) return "Sem pendências.";

  const extra = findings.length - 1;
  const tail = extra > 0 ? ` (+${extra} ${extra === 1 ? "pendência" : "pendências"})` : "";

  return status === "NEEDS_CORRECTION"
    ? `Corrigir antes do envio: ${first.message}${tail}`
    : `Precisa de decisão humana: ${first.message}${tail}`;
}

/**
 * The human-readable "why did this guide fall out?" paragraph, assembled from
 * the findings that were actually stored. Nothing here is generated after the
 * fact, so the explanation can never drift from the decision it explains.
 */
export function explainDecision(findings: readonly Finding[]): readonly string[] {
  return findings
    .filter((finding) => finding.severity !== "INFO")
    .map((finding) =>
      finding.evidence === null
        ? finding.message
        : `${finding.message} Observação da recepção: “${finding.evidence}”`,
    );
}

export function recommendedActions(findings: readonly Finding[]): readonly string[] {
  const actions = findings
    .map((finding) => finding.recommendedAction)
    .filter((action): action is string => action !== null);

  return [...new Set(actions)];
}

export interface RuleSetStamp {
  readonly version: string;
  readonly hash: string;
}

export interface ObservationAudit {
  readonly interpreter: string;
  readonly model: string | null;
  readonly interpretation: ObservationInterpretation;
}

/** Everything a single preflight produced - the unit persisted and displayed. */
export interface ValidationResult {
  readonly guide: NormalizedGuide;
  readonly decision: GuideDecision;
  readonly findings: readonly Finding[];
  readonly rules: RuleSetStamp;
  /** `null` when the guide carries no reception note. */
  readonly observation: ObservationAudit | null;
}
