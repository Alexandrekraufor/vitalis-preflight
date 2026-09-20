import { CircleAlert, CircleCheck, CircleHelp } from "lucide-react";
import type { ReactNode } from "react";

import type { PeriodComparison } from "@/application/reports/get-period-report.use-case";
import type { PortfolioSummary } from "@/application/reports/portfolio-summary";
import { Card, CardHeader } from "@/components/ui/card";
import { formatBrl } from "@/lib/money";

interface WeeklyReadoutProps {
  readonly summary: PortfolioSummary;
  readonly previous: PeriodComparison | null;
  readonly days: number;
}

function percent(part: number, whole: number): string {
  return `${whole === 0 ? 0 : Math.round((part / whole) * 100)}%`;
}

const TONE = {
  ready: { icon: CircleCheck, text: "text-ready", soft: "bg-ready-soft" },
  danger: { icon: CircleAlert, text: "text-danger", soft: "bg-danger-soft" },
  review: { icon: CircleHelp, text: "text-review", soft: "bg-review-soft" },
} as const;

function Line({
  tone,
  count,
  share,
  children,
}: {
  readonly tone: keyof typeof TONE;
  readonly count: number;
  readonly share: string;
  readonly children: ReactNode;
}) {
  const { icon: Icon, text, soft } = TONE[tone];

  return (
    <li className="flex items-start gap-3.5">
      <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${soft}`}>
        <Icon aria-hidden className={`size-4 ${text}`} />
      </span>
      <span className="min-w-0">
        <span className="flex items-baseline gap-2">
          <strong className={`numeric text-2xl font-bold leading-none tracking-tight ${text}`}>
            {count}
          </strong>
          <span className="numeric text-xs font-medium text-ink-muted">{share} do período</span>
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-ink">{children}</span>
      </span>
    </li>
  );
}

/**
 * The week in three lines, one per decision.
 *
 * The earlier version was a paragraph: correct, and unreadable at a glance,
 * because every number had the same weight as the words around it. Here the
 * count is the first thing the eye lands on, the colour says which of the
 * three states it is, and the sentence explains only what the number cannot.
 */
export function WeeklyReadout({ summary, previous, days }: WeeklyReadoutProps) {
  const topProblem = summary.topProblems.at(0);
  const worstUnit = summary.byUnit
    .toSorted(
      (left, right) =>
        right.needsCorrection +
        right.reviewRequired -
        (left.needsCorrection + left.reviewRequired),
    )
    .at(0);

  return (
    <Card>
      <CardHeader
        title={days === 7 ? "Leitura da semana" : "Leitura do período"}
        description="O que aconteceu, em três linhas."
      />

      <ul className="flex flex-col gap-5 px-5 py-5">
        <Line
          tone="ready"
          count={summary.readyToSubmit}
          share={percent(summary.readyToSubmit, summary.total)}
        >
          saíram limpas e podem ser faturadas - {formatBrl(summary.amountProtected)} liberados
          sem risco de glosa.
        </Line>

        <Line
          tone="danger"
          count={summary.needsCorrection}
          share={percent(summary.needsCorrection, summary.total)}
        >
          {summary.needsCorrection === 0 ? (
            <>não houve guia barrada por erro objetivo neste período.</>
          ) : (
            <>
              travaram por erro objetivo, segurando{" "}
              <strong className="font-semibold text-ink">
                {formatBrl(summary.amountAtRisk)}
              </strong>
              .{" "}
              {topProblem !== undefined && (
                <>
                  A causa mais comum é{" "}
                  <strong className="font-semibold text-ink">
                    {topProblem.label.toLowerCase()}
                  </strong>
                  , em {topProblem.guides}{" "}
                  {topProblem.guides === 1 ? "guia" : "guias"}.
                </>
              )}{" "}
              {worstUnit !== undefined &&
                worstUnit.needsCorrection + worstUnit.reviewRequired > 0 && (
                  <>
                    A unidade que mais trava é{" "}
                    <strong className="font-semibold text-ink">{worstUnit.unit}</strong>.
                  </>
                )}
            </>
          )}
        </Line>

        <Line
          tone="review"
          count={summary.reviewRequired}
          share={percent(summary.reviewRequired, summary.total)}
        >
          {summary.reviewRequired === 0
            ? "nenhuma guia precisou de decisão humana."
            : "trazem dados contraditórios e precisam de uma decisão humana antes do envio."}
        </Line>
      </ul>

      {previous !== null && (
        <p className="border-t border-border-subtle px-5 py-3.5 text-sm text-ink-muted">
          {days === 7 ? "Na semana anterior foram " : `Nos ${days} dias anteriores foram `}
          <strong className="numeric font-semibold text-ink">{previous.guidesChecked}</strong>{" "}
          guias verificadas, com{" "}
          <strong className="numeric font-semibold text-ink">
            {formatBrl(previous.amountAtRisk)}
          </strong>{" "}
          em risco.
        </p>
      )}
    </Card>
  );
}
