import type {
  GuideListFilter,
  GuideListItem,
  GuideRepository,
} from "../ports/guide-repository.port";
import type { ImportRecord, ImportRepository } from "../ports/import-repository.port";

import { summarizePortfolio, type PortfolioSummary } from "./portfolio-summary";

export interface OperationalSummary {
  readonly summary: PortfolioSummary;
  /** Guides that cannot be submitted, worst money first — Carla's work queue. */
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

  return { summary: summarizePortfolio(items), actionQueue, recentImports };
}
