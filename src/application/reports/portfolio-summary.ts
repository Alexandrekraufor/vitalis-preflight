import { findingLabel } from "@/domain/rules/finding-codes";
import type { ClinicUnit } from "@/domain/guides/guide.types";
import { fromCents, sum, ZERO, type Money } from "@/lib/money";

import type { GuideListItem } from "../ports/guide-repository.port";

export interface StatusCounts {
  readonly total: number;
  readonly readyToSubmit: number;
  readonly needsCorrection: number;
  readonly reviewRequired: number;
}

export interface ProblemCount {
  readonly code: string;
  readonly label: string;
  readonly guides: number;
  readonly amountAtRisk: Money;
}

export interface UnitBreakdown extends StatusCounts {
  readonly unit: ClinicUnit;
  readonly amountAtRisk: Money;
}

export interface PortfolioSummary extends StatusCounts {
  readonly amountAtRisk: Money;
  /** Billed value of the guides that came out clean. */
  readonly amountProtected: Money;
  readonly topProblems: readonly ProblemCount[];
  readonly byUnit: readonly UnitBreakdown[];
}

const EMPTY_COUNTS = {
  total: 0,
  readyToSubmit: 0,
  needsCorrection: 0,
  reviewRequired: 0,
} as const;

function countByStatus(items: readonly GuideListItem[]): StatusCounts {
  return items.reduce<StatusCounts>(
    (counts, item) => ({
      total: counts.total + 1,
      readyToSubmit: counts.readyToSubmit + (item.status === "READY_TO_SUBMIT" ? 1 : 0),
      needsCorrection: counts.needsCorrection + (item.status === "NEEDS_CORRECTION" ? 1 : 0),
      reviewRequired: counts.reviewRequired + (item.status === "REVIEW_REQUIRED" ? 1 : 0),
    }),
    EMPTY_COUNTS,
  );
}

function countProblems(items: readonly GuideListItem[]): readonly ProblemCount[] {
  const tally = new Map<string, { guides: number; amountAtRisk: number }>();

  for (const item of items) {
    const code = item.primaryFindingCode;
    if (code === null) continue;

    const current = tally.get(code) ?? { guides: 0, amountAtRisk: 0 };
    tally.set(code, {
      guides: current.guides + 1,
      amountAtRisk: current.amountAtRisk + item.amountAtRisk,
    });
  }

  return [...tally.entries()]
    .map(([code, value]) => ({
      code,
      label: findingLabel(code),
      guides: value.guides,
      amountAtRisk: fromCents(value.amountAtRisk),
    }))
    .sort((left, right) => right.guides - left.guides || right.amountAtRisk - left.amountAtRisk);
}

function breakdownByUnit(items: readonly GuideListItem[]): readonly UnitBreakdown[] {
  const units = [...new Set(items.map((item) => item.unit))].sort();

  return units.map((unit) => {
    const ofUnit = items.filter((item) => item.unit === unit);
    return {
      unit,
      ...countByStatus(ofUnit),
      amountAtRisk: sum(ofUnit.map((item) => item.amountAtRisk)),
    };
  });
}

/**
 * Turns a list of validated guides into the numbers every screen shows. Pure on
 * purpose: the dashboard, the executive report and the MCP summary tool all
 * read the same arithmetic, and it is unit-testable without a database.
 */
export function summarizePortfolio(items: readonly GuideListItem[]): PortfolioSummary {
  const protectedAmounts = items
    .filter((item) => item.status === "READY_TO_SUBMIT")
    .map((item) => item.amount ?? ZERO);

  return {
    ...countByStatus(items),
    amountAtRisk: sum(items.map((item) => item.amountAtRisk)),
    amountProtected: sum(protectedAmounts),
    topProblems: countProblems(items),
    byUnit: breakdownByUnit(items),
  };
}

export function statusShare(counts: StatusCounts): number {
  if (counts.total === 0) return 0;
  return (counts.needsCorrection + counts.reviewRequired) / counts.total;
}
