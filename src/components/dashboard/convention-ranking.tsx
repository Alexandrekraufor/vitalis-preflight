import type { ConventionCount } from "@/application/reports/portfolio-summary";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBrl } from "@/lib/money";

interface ConventionRankingProps {
  readonly conventions: readonly ConventionCount[];
  readonly totalGuides: number;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Who actually sends work through the clinic, in order of volume.
 *
 * Volume and problems are different questions, so both are on the row: a
 * convention can be the largest source of guides and still be the cleanest,
 * and that is exactly the thing worth seeing at a glance.
 */
export function ConventionRanking({ conventions, totalGuides }: ConventionRankingProps) {
  return (
    <Card>
      <CardHeader
        title="Convênios"
        description="Volume de guias por convênio, e quanto de cada um trava."
      />

      {conventions.length === 0 ? (
        <EmptyState
          title="Nenhum convênio no período"
          description="Importe guias para ver quais convênios movimentam a clínica."
        />
      ) : (
        <ol className="flex flex-col gap-4 px-5 py-4">
          {conventions.map((convention, index) => {
            const blocked = convention.needsCorrection + convention.reviewRequired;
            const share = totalGuides === 0 ? 0 : convention.total / totalGuides;

            return (
              <li key={convention.convention} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {convention.convention}
                    </span>
                    {index === 0 && (
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-brand">
                        mais usado
                      </span>
                    )}
                  </span>
                  <span className="numeric text-sm text-ink-muted">
                    <strong className="font-semibold text-ink">{convention.total}</strong>{" "}
                    {convention.total === 1 ? "guia" : "guias"} · {percent(share)} do período
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-canvas">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.max(share * 100, 3)}%` }}
                  />
                </div>

                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-ink-muted">
                  <span className="numeric">
                    Faturamento do período: {formatBrl(convention.amountBilled)}
                  </span>
                  <span className="numeric">
                    {blocked === 0 ? (
                      <span className="font-medium text-ready">nenhuma travada</span>
                    ) : (
                      <>
                        <strong className="font-semibold text-ink">{blocked}</strong> travadas ·{" "}
                        <span className="font-medium text-warn">
                          {formatBrl(convention.amountAtRisk)} em risco
                        </span>
                      </>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
