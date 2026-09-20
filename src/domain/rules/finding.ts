import type { GuideColumn } from "@/domain/normalization/normalization.types";

import type { FindingCode } from "./finding-codes";

/**
 * How much a finding weighs on the final decision.
 *
 * - `BLOCKING`: objectively wrong and fixable before submitting.
 * - `REVIEW`: the data is contradictory or the situation is outside what a rule
 *   can settle; a person has to decide.
 * - `INFO`: worth showing, but it changes nothing about the decision.
 */
export type FindingSeverity = "BLOCKING" | "REVIEW" | "INFO";

/** Where the finding came from - the audit trail depends on this being honest. */
export type FindingSource =
  | "CONVENTION_RULE"
  | "REFERENCE_TABLE"
  | "RECEPTION_NOTE";

export interface Finding {
  readonly code: FindingCode;
  readonly severity: FindingSeverity;
  /** Column the problem points at, when there is exactly one. */
  readonly field: GuideColumn | null;
  readonly message: string;
  readonly expected: string | null;
  readonly actual: string | null;
  readonly source: FindingSource;
  /**
   * Verbatim excerpt of the reception note that supports the finding. Always
   * present for `RECEPTION_NOTE` findings and never invented.
   */
  readonly evidence: string | null;
  readonly recommendedAction: string | null;
}

export function hasSeverity(
  findings: readonly Finding[],
  severity: FindingSeverity,
): boolean {
  return findings.some((finding) => finding.severity === severity);
}
