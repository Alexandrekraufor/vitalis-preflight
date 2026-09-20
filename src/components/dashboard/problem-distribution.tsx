import type { ProblemCount } from "@/application/reports/portfolio-summary";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBrl } from "@/lib/money";

interface ProblemDistributionProps {
  readonly problems: readonly ProblemCount[];
  readonly limit?: number;
}

/**
 * A ranked bar list rather than a pie: the question is "what do we fix first",
 * and the answer is an ordering with a number next to it.
 */
export function ProblemDistribution({ problems, limit = 6 }: ProblemDistributionProps) {
  const top = problems.slice(0, limit);
  const largest = top[0]?.guides ?? 1;

  return (
    <Card>
      <CardHeader
        title="Principais causas"
        description="Problema que derrubou cada guia, por frequência."
      />
      {top.length === 0 ? (
        <EmptyState
          title="Nenhum problema encontrado"
          description="Todas as guias verificadas estão prontas para envio."
        />
      ) : (
        <CardBody>
          <ul className="flex flex-col gap-3">
            {top.map((problem) => (
              <li key={problem.code}>
                <div className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="text-ink">{problem.label}</span>
                  <span className="numeric shrink-0 text-ink-muted">
                    {problem.guides} {problem.guides === 1 ? "guia" : "guias"} ·{" "}
                    {formatBrl(problem.amountAtRisk)}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-canvas"
                  role="presentation"
                >
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.round((problem.guides / largest) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      )}
    </Card>
  );
}
