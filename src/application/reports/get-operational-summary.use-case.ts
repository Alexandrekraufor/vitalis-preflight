import type {
  GuideListFilter,
  GuideListItem,
  GuideRepository,
} from "../ports/guide-repository.port";
import type { ImportRecord, ImportRepository } from "../ports/import-repository.port";

import { compareIsoDates, type IsoDate } from "@/lib/dates";

import { summarizePortfolio, type PortfolioSummary } from "./portfolio-summary";

/** The stretch of appointments the dashboard is actually summarising. */
export interface Coverage {
  readonly from: IsoDate;
  readonly through: IsoDate;
}

export interface OperationalSummary {
  readonly summary: PortfolioSummary;
  /**
   * Without this the screen shows a total with no period attached, and the
   * reader cannot tell why it differs from the weekly report.
   */
  readonly coverage: Coverage | null;
  /** Guides that cannot be submitted, worst money first - Carla's work queue. */
  readonly actionQueue: readonly GuideListItem[];
  readonly recentImports: readonly ImportRecord[];
}

export interface OperationalSummaryDependencies {
  readonly guides: GuideRepository;
  readonly imports: ImportRepository;
}

const ACTION_QUEUE_SIZE = 12;
const RECENT_IMPORTS = 5;

/**
 * The operations dashboard: what was checked, what is blocked, what it is
 * worth, and which guides to open first.
 */
export async function getOperationalSummary(
  filter: GuideListFilter,
  { guides, imports }: OperationalSummaryDependencies,
): Promise<OperationalSummary> {
  const [items, recentImports] = await Promise.all([
    guides.list(filter),
    imports.listRecent(RECENT_IMPORTS),
  ]);

  const actionQueue = items
    .filter((item) => item.status !== "READY_TO_SUBMIT")
    .toSorted((left, right) => right.amountAtRisk - left.amountAtRisk)
    .slice(0, ACTION_QUEUE_SIZE);

  return { summary: summarizePortfolio(items), coverage: coverageOf(items), actionQueue, recentImports };
}

function coverageOf(items: readonly GuideListItem[]): Coverage | null {
  const first = items.at(0);
  if (first === undefined) return null;

  return items.reduce<Coverage>(
    (range, item) => ({
      from: compareIsoDates(item.appointmentDate, range.from) < 0 ? item.appointmentDate : range.from,
      through:
        compareIsoDates(item.appointmentDate, range.through) > 0
          ? item.appointmentDate
          : range.through,
    }),
    { from: first.appointmentDate, through: first.appointmentDate },
  );
}
