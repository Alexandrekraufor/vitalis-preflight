import { addDays, compareIsoDates, type IsoDate } from "@/lib/dates";
import { fromCents, type Money } from "@/lib/money";

import type { GuideListItem, GuideRepository } from "../ports/guide-repository.port";

import {
  statusShare,
  summarizePortfolio,
  type PortfolioSummary,
} from "./portfolio-summary";

export const WEEKLY_PERIOD_DAYS = 7;

export interface ReportPeriod {
  readonly from: IsoDate;
  readonly through: IsoDate;
}

export interface PeriodComparison {
  readonly guidesChecked: number;
  readonly problemShare: number;
  readonly amountAtRisk: Money;
}

export interface WeeklyReport {
  readonly period: ReportPeriod;
  readonly summary: PortfolioSummary;
  readonly problemShare: number;
  /** `null` when there is no data for the preceding period to compare against. */
  readonly previous: PeriodComparison | null;
}

function within(item: GuideListItem, period: ReportPeriod): boolean {
  return (
    compareIsoDates(item.appointmentDate, period.from) >= 0 &&
    compareIsoDates(item.appointmentDate, period.through) <= 0
  );
}

function periodEndingAt(through: IsoDate): ReportPeriod {
  return { from: addDays(through, -(WEEKLY_PERIOD_DAYS - 1)), through };
}

/** Latest appointment on record, so the report defaults to the data that exists. */
function latestAppointmentDate(items: readonly GuideListItem[]): IsoDate | null {
  return items.reduce<IsoDate | null>(
    (latest, item) =>
      latest === null || compareIsoDates(item.appointmentDate, latest) > 0
        ? item.appointmentDate
        : latest,
    null,
  );
}

export interface WeeklyReportOptions {
  /** Last day of the reported week. Defaults to the latest appointment on record. */
  readonly through?: IsoDate;
}

/**
 * The Tuesday report: one week of guides, compared with the week before.
 *
 * Aggregation happens in memory because the whole portfolio is a few hundred
 * rows. If the clinic grows past that, this is the function that moves into SQL
 * — nothing else has to change.
 */
export async function getWeeklyReport(
  guides: GuideRepository,
  options: WeeklyReportOptions = {},
): Promise<WeeklyReport | null> {
  const items = await guides.list({});
  const through = options.through ?? latestAppointmentDate(items);

  if (through === null) return null;

  const period = periodEndingAt(through);
  const previousPeriod = periodEndingAt(addDays(period.from, -1));

  const current = items.filter((item) => within(item, period));
  const previous = items.filter((item) => within(item, previousPeriod));

  const summary = summarizePortfolio(current);

  return {
    period,
    summary,
    problemShare: statusShare(summary),
    previous:
      previous.length === 0
        ? null
        : {
            guidesChecked: previous.length,
            problemShare: statusShare(summarizePortfolio(previous)),
            amountAtRisk: fromCents(
              previous.reduce((total, item) => total + item.amountAtRisk, 0),
            ),
          },
  };
}
