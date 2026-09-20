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

/** How much of a set of guides one convention accounts for. */
export interface ConventionShare {
  readonly convention: string;
  readonly guides: number;
  /** Fraction of the set, between 0 and 1. */
  readonly share: number;
}

export interface ConventionCount extends StatusCounts {
  readonly convention: string;
  readonly amountAtRisk: Money;
  /** Everything billed under this convention, cleared or not. */
  readonly amountBilled: Money;
}

export interface UnitBreakdown extends StatusCounts {
  readonly unit: ClinicUnit;
  readonly amountAtRisk: Money;
  /** The convention that brings this unit the most guides; `null` when empty. */
  readonly topConvention: ConventionShare | null;
}

export interface PortfolioSummary extends StatusCounts {
  readonly amountAtRisk: Money;
  /** Billed value of the guides that came out clean. */
  readonly amountProtected: Money;
  /**
   * Everything the period is worth, cleared or blocked. Without it the reader
   * has to add two figures to learn how big the pot actually is.
   */
  readonly amountBilled: Money;
  readonly topProblems: readonly ProblemCount[];
  readonly byUnit: readonly UnitBreakdown[];
  /** Conventions by volume: who actually sends work through this clinic. */
  readonly byConvention: readonly ConventionCount[];
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

/** The convention with the most guides in a set. Ties break alphabetically. */
function leadingConvention(items: readonly GuideListItem[]): ConventionShare | null {
  const tally = new Map<string, number>();
  for (const item of items) {
    tally.set(item.conventionName, (tally.get(item.conventionName) ?? 0) + 1);
  }

  const leader = [...tally.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .at(0);

  if (leader === undefined) return null;

  return {
    convention: leader[0],
    guides: leader[1],
    share: items.length === 0 ? 0 : leader[1] / items.length,
  };
}

function countByConvention(items: readonly GuideListItem[]): readonly ConventionCount[] {
  const conventions = [...new Set(items.map((item) => item.conventionName))];

  return conventions
    .map((convention) => {
      const ofConvention = items.filter((item) => item.conventionName === convention);
      return {
        convention,
        ...countByStatus(ofConvention),
        amountAtRisk: sum(ofConvention.map((item) => item.amountAtRisk)),
        amountBilled: sum(ofConvention.map((item) => item.amount ?? ZERO)),
      };
    })
    .sort(
      (left, right) =>
        right.total - left.total || left.convention.localeCompare(right.convention),
    );
}

function breakdownByUnit(items: readonly GuideListItem[]): readonly UnitBreakdown[] {
  const units = [...new Set(items.map((item) => item.unit))].sort();

  return units.map((unit) => {
    const ofUnit = items.filter((item) => item.unit === unit);
    return {
      unit,
      ...countByStatus(ofUnit),
      amountAtRisk: sum(ofUnit.map((item) => item.amountAtRisk)),
      topConvention: leadingConvention(ofUnit),
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
    amountBilled: sum(items.map((item) => item.amount ?? ZERO)),
    topProblems: countProblems(items),
    byUnit: breakdownByUnit(items),
    byConvention: countByConvention(items),
  };
}

export function statusShare(counts: StatusCounts): number {
  if (counts.total === 0) return 0;
  return (counts.needsCorrection + counts.reviewRequired) / counts.total;
}
