import type { ValidationRunSummary } from "@/application/ports/guide-repository.port";
import { Card, CardBody } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatBrl } from "@/lib/money";

interface DecisionPanelProps {
  readonly run: ValidationRunSummary;
  readonly recommendedActions: readonly string[];
}

/**
 * The answer to the reception's only question: can this guide go out, and if
 * not, what has to happen first.
 */
export function DecisionPanel({ run, recommendedActions }: DecisionPanelProps) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusBadge status={run.decision} size="md" />
          <div className="text-right">
            <p className="text-xs text-ink-muted">Valor em risco</p>
            <p className="numeric text-lg font-semibold text-ink">
              {formatBrl(run.amountAtRisk)}
            </p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-ink">{run.decisionSummary}</p>

        {recommendedActions.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Ações recomendadas
            </h2>
            <ol className="mt-2 flex flex-col gap-1.5">
              {recommendedActions.map((action, index) => (
                <li key={action} className="flex gap-2.5 text-sm text-ink">
                  <span className="numeric shrink-0 font-medium text-brand">{index + 1}.</span>
                  {action}
                </li>
              ))}
            </ol>
          </div>
        )}

        <dl className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border-subtle pt-3 text-xs text-ink-muted">
          <div className="flex gap-1.5">
            <dt>Versão das regras:</dt>
            <dd className="text-ink">{run.rulesVersion}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Hash das regras:</dt>
            <dd className="numeric text-ink" title={run.rulesHash}>
              {run.rulesHash.slice(0, 12)}…
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Interpretação da observação:</dt>
            <dd className="text-ink">
              {run.observationInterpreter === null
                ? "não aplicável"
                : `${run.observationInterpreter}${run.observationModel === null ? "" : ` (${run.observationModel})`}`}
            </dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  );
}
