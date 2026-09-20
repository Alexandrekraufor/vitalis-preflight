import type { ClinicUnit } from "@/domain/guides/guide.types";
import { addDays, compareIsoDates, daysBetween, type IsoDate } from "@/lib/dates";
import { fromCents, type Money } from "@/lib/money";

import type {
  GuideListFilter,
  GuideListItem,
  GuideRepository,
} from "../ports/guide-repository.port";

import { statusShare, summarizePortfolio, type PortfolioSummary } from "./portfolio-summary";

/** Window lengths the report offers as one click. */
export const PERIOD_PRESETS = [7, 15, 30, 90] as const;

export const DEFAULT_PERIOD_DAYS = 7;
export const MAX_PERIOD_DAYS = 366;

export interface ReportPeriod {
  readonly from: IsoDate;
  readonly through: IsoDate;
}

export interface PeriodComparison {
  readonly guidesChecked: number;
  readonly problemShare: number;
  readonly amountAtRisk: Money;
}

export interface ReportScope {
  readonly unit: ClinicUnit | null;
  readonly convention: string | null;
}

export interface PeriodReport {
  readonly period: ReportPeriod;
  /** Length of the window, in days, inclusive on both ends. */
  readonly days: number;
  readonly scope: ReportScope;
  readonly summary: PortfolioSummary;
  readonly problemShare: number;
  /** `null` when there is no data in the preceding window to compare against. */
  readonly previous: PeriodComparison | null;
  /**
   * Everything on record under the same scope, not just this window. The
   * report cuts a period out of a larger portfolio, and saying so is what
   * keeps it from looking like it contradicts the dashboard.
   */
  readonly portfolioGuides: number;
}

export interface ReportQuery {
  /** Window length. Ignored when `from` is given, which states the length itself. */
  readonly days?: number;
  readonly from?: IsoDate;
  /** Last day of the window. Defaults to the latest appointment in scope. */
  readonly through?: IsoDate;
  readonly unit?: ClinicUnit;
  readonly convention?: string;
}

/** Latest appointment in scope, so the report defaults to data that exists. */
function latestAppointmentDate(items: readonly GuideListItem[]): IsoDate | null {
  return items.reduce<IsoDate | null>(
    (latest, item) =>
      latest === null || compareIsoDates(item.appointmentDate, latest) > 0
        ? item.appointmentDate
        : latest,
    null,
  );
}

function clampDays(days: number): number {
  if (!Number.isFinite(days)) return DEFAULT_PERIOD_DAYS;
  return Math.min(MAX_PERIOD_DAYS, Math.max(1, Math.trunc(days)));
}

function scopeFilter(query: ReportQuery): GuideListFilter {
  return {
    ...(query.unit === undefined ? {} : { unit: query.unit }),
    ...(query.convention === undefined ? {} : { conventionName: query.convention }),
  };
}

function comparisonOf(items: readonly GuideListItem[]): PeriodComparison | null {
  if (items.length === 0) return null;

  return {
    guidesChecked: items.length,
    problemShare: statusShare(summarizePortfolio(items)),
    amountAtRisk: fromCents(items.reduce((total, item) => total + item.amountAtRisk, 0)),
  };
}

/**
 * The executive report over any window, for the whole clinic or one slice of
 * it.
 *
 * The comparison is always against the window immediately before, of the same
 * length: thirty days are compared with the thirty before them, not with a
 * fixed week, because otherwise the arrow would answer a different question
 * than the number above it.
 *
 * Filtering happens in the repository, not in memory, so asking for one unit
 * reads one unit.
 */
export async function getPeriodReport(
  guides: GuideRepository,
  query: ReportQuery = {},
): Promise<PeriodReport | null> {
  const scope = scopeFilter(query);
  const inScope = await guides.list(scope);

  const through = query.through ?? latestAppointmentDate(inScope);
  if (through === null) return null;

  const days =
    query.from === undefined
      ? clampDays(query.days ?? DEFAULT_PERIOD_DAYS)
      : clampDays(daysBetween(query.from, through) + 1);

  // A window that ends before it starts is a hand-edited link, not a request:
  // it collapses to the single day the reader asked to end on.
  const from = query.from !== undefined && days > 0 ? query.from : addDays(through, -(days - 1));

  const period: ReportPeriod = compareIsoDates(from, through) > 0 ? { from: through, through } : { from, through };

  const previousPeriod: ReportPeriod = {
    from: addDays(period.from, -days),
    through: addDays(period.from, -1),
  };

  const [current, previous] = await Promise.all([
    guides.list({ ...scope, from: period.from, through: period.through }),
    guides.list({ ...scope, from: previousPeriod.from, through: previousPeriod.through }),
  ]);

  const summary = summarizePortfolio(current);

  return {
    period,
    days,
    scope: {
      unit: query.unit ?? null,
      convention: query.convention ?? null,
    },
    summary,
    problemShare: statusShare(summary),
    previous: comparisonOf(previous),
    portfolioGuides: inScope.length,
  };
}
