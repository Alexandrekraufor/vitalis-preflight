import type { PortfolioSummary } from "./portfolio-summary";

export interface AttentionPoint {
  readonly headline: string;
  readonly detail: string;
}

/** Below this, a "concentration" is just how small numbers land. */
const CONCENTRATION_THRESHOLD = 0.4;
const MINIMUM_PROBLEMS = 3;

function share(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * The one sentence the owner should read first — or nothing.
 *
 * This deliberately returns `null` rather than manufacturing an insight. With
 * four problems spread over three units, "Norte concentra 50%" is arithmetic
 * about two guides, not a finding, and printing it would teach the reader to
 * distrust the number. A claim is only made when there are enough problems for
 * a concentration to mean something and one unit or one cause actually stands
 * out.
 */
export function findAttentionPoint(summary: PortfolioSummary): AttentionPoint | null {
  const totalProblems = summary.needsCorrection + summary.reviewRequired;
  if (totalProblems < MINIMUM_PROBLEMS) return null;

  const worstUnit = summary.byUnit
    .map((unit) => ({
      unit,
      problems: unit.needsCorrection + unit.reviewRequired,
    }))
    .toSorted((left, right) => right.problems - left.problems)
    .at(0);

  if (worstUnit !== undefined) {
    const unitShare = share(worstUnit.problems, totalProblems);

    if (unitShare >= CONCENTRATION_THRESHOLD && summary.byUnit.length > 1) {
      return {
        headline: `A unidade ${worstUnit.unit.unit} concentra ${percent(unitShare)} das inconsistências do período.`,
        detail: `${worstUnit.problems} das ${totalProblems} guias com problema são da unidade ${worstUnit.unit.unit}, de ${worstUnit.unit.total} verificadas ali.`,
      };
    }
  }

  const topProblem = summary.topProblems.at(0);
  if (topProblem === undefined) return null;

  const causeShare = share(topProblem.guides, totalProblems);
  if (causeShare < CONCENTRATION_THRESHOLD) return null;

  return {
    headline: `${percent(causeShare)} das inconsistências têm a mesma causa: ${topProblem.label.toLowerCase()}.`,
    detail: `${topProblem.guides} das ${totalProblems} guias com problema pararam por isso. Resolver essa causa libera a maior parte da fila.`,
  };
}
