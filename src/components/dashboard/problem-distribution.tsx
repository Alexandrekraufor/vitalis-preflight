import type { ProblemCount } from "@/application/reports/portfolio-summary";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBrl } from "@/lib/money";

interface ProblemDistributionProps {
  readonly problems: readonly ProblemCount[];
  readonly limit?: number;
}

/**
 * The causes, ranked, with the number and the money on the row itself.
 *
 * A bar chart would hide both behind a hover: the reader would have to aim at
 * a rectangle to learn what it is worth. Here the bar only encodes the
 * comparison - every value the reader needs is already written down, and the
 * whole thing renders on the server.
 */
export function ProblemDistribution({ problems, limit = 6 }: ProblemDistributionProps) {
  const top = problems.slice(0, limit);
  const largest = top.reduce((highest, problem) => Math.max(highest, problem.guides), 0);

  return (
    <Card>
      <CardHeader
        title="Principais causas"
        description="O problema que derrubou cada guia, da mais frequente para a menos."
      />

      {top.length === 0 ? (
        <EmptyState
          title="Nenhum problema encontrado"
          description="Todas as guias verificadas estão prontas para envio."
        />
      ) : (
        <ol className="flex flex-col gap-3.5 px-5 py-4">
          {top.map((problem, index) => (
            <li key={problem.code} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="numeric text-xs font-semibold text-ink-faint">
                    {index + 1}
                  </span>
                  <span className="truncate text-sm font-medium text-ink">{problem.label}</span>
                </span>
                <span className="numeric shrink-0 text-sm font-semibold text-ink">
                  {problem.guides}
                  <span className="ml-1 text-xs font-normal text-ink-muted">
                    {problem.guides === 1 ? "guia" : "guias"}
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-canvas">
                  <div
                    className="h-full rounded-full bg-warn"
                    style={{
                      width: `${largest === 0 ? 0 : Math.max(4, (problem.guides / largest) * 100)}%`,
                    }}
                  />
                </div>
                <span className="numeric w-28 shrink-0 text-right text-xs font-medium text-warn">
                  {formatBrl(problem.amountAtRisk)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
