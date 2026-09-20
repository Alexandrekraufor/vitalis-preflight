import { toDecimalString, type Money } from "@/lib/money";

import type { PeriodReport } from "./get-period-report.use-case";

/**
 * Public shape of a report, shared by every machine-facing surface.
 *
 * Money is published in reais because that is what a consumer expects to see;
 * internally it stays an integer number of cents, and the conversion happens
 * here, once.
 */
export interface PeriodReportPayload {
  readonly period: { readonly from: string; readonly through: string };
  readonly days: number;
  readonly scope: { readonly unit: string | null; readonly convention: string | null };
  readonly problemShare: number;
  readonly summary: {
    readonly total: number;
    readonly readyToSubmit: number;
    readonly needsCorrection: number;
    readonly reviewRequired: number;
    readonly amountAtRisk: number;
    readonly amountProtected: number;
    readonly amountBilled: number;
    readonly topProblems: readonly {
      readonly code: string;
      readonly label: string;
      readonly guides: number;
      readonly amountAtRisk: number;
    }[];
    readonly byUnit: readonly {
      readonly unit: string;
      readonly total: number;
      readonly readyToSubmit: number;
      readonly needsCorrection: number;
      readonly reviewRequired: number;
      readonly amountAtRisk: number;
      readonly topConvention: string | null;
    }[];
    readonly byConvention: readonly {
      readonly convention: string;
      readonly total: number;
      readonly readyToSubmit: number;
      readonly needsCorrection: number;
      readonly reviewRequired: number;
      readonly amountAtRisk: number;
      readonly amountBilled: number;
    }[];
  };
  readonly previous: {
    readonly guidesChecked: number;
    readonly problemShare: number;
    readonly amountAtRisk: number;
  } | null;
  readonly portfolioGuides: number;
}

function toReais(amount: Money): number {
  return Number(toDecimalString(amount));
}

export function toPeriodReportPayload(report: PeriodReport): PeriodReportPayload {
  return {
    period: report.period,
    days: report.days,
    scope: report.scope,
    problemShare: report.problemShare,
    summary: {
      total: report.summary.total,
      readyToSubmit: report.summary.readyToSubmit,
      needsCorrection: report.summary.needsCorrection,
      reviewRequired: report.summary.reviewRequired,
      amountAtRisk: toReais(report.summary.amountAtRisk),
      amountProtected: toReais(report.summary.amountProtected),
      amountBilled: toReais(report.summary.amountBilled),
      topProblems: report.summary.topProblems.map((problem) => ({
        code: problem.code,
        label: problem.label,
        guides: problem.guides,
        amountAtRisk: toReais(problem.amountAtRisk),
      })),
      byUnit: report.summary.byUnit.map((unit) => ({
        unit: unit.unit,
        total: unit.total,
        readyToSubmit: unit.readyToSubmit,
        needsCorrection: unit.needsCorrection,
        reviewRequired: unit.reviewRequired,
        amountAtRisk: toReais(unit.amountAtRisk),
        topConvention: unit.topConvention?.convention ?? null,
      })),
      byConvention: report.summary.byConvention.map((convention) => ({
        convention: convention.convention,
        total: convention.total,
        readyToSubmit: convention.readyToSubmit,
        needsCorrection: convention.needsCorrection,
        reviewRequired: convention.reviewRequired,
        amountAtRisk: toReais(convention.amountAtRisk),
        amountBilled: toReais(convention.amountBilled),
      })),
    },
    previous:
      report.previous === null
        ? null
        : {
            guidesChecked: report.previous.guidesChecked,
            problemShare: report.previous.problemShare,
            amountAtRisk: toReais(report.previous.amountAtRisk),
          },
    portfolioGuides: report.portfolioGuides,
  };
}
