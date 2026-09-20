import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import type { PeriodComparison } from "@/application/reports/get-period-report.use-case";
import type { PortfolioSummary } from "@/application/reports/portfolio-summary";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatBrl } from "@/lib/money";

interface WeeklyComparisonProps {
  readonly summary: PortfolioSummary;
  readonly problemShare: number;
  readonly previous: PeriodComparison | null;
  /** Length of the window, so the wording matches what was actually compared. */
  readonly days: number;
}

/**
 * The state of a number, which is what colours it.
 *
 * Colour answers "is this good?", never "did it go up?". Money at risk is red
 * while it is above zero, even in a week where it fell by half - a smaller
 * problem is still a problem, and painting it green tells the owner the
 * opposite of the truth.
 */
type State = "good" | "bad" | "neutral";

interface Metric {
  readonly label: string;
  readonly value: string;
  readonly state: State;
  readonly caption: string;
  readonly comparison: { readonly from: string; readonly better: boolean } | null;
}

const VALUE_CLASS: Readonly<Record<State, string>> = {
  good: "text-ready",
  bad: "text-danger",
  neutral: "text-ink",
};

/** "a semana passada" reads wrong under a thirty-day window. */
function previousLabel(days: number): string {
  if (days === 7) return "que a semana passada";
  if (days === 1) return "que o dia anterior";
  return `que os ${days} dias anteriores`;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function Trend({ metric, days }: { readonly metric: Metric; readonly days: number }) {
  const Arrow =
    metric.comparison === null ? Minus : metric.comparison.better ? ArrowDown : ArrowUp;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
        {metric.label}
      </p>
      <p className={`numeric text-3xl font-bold tracking-tight ${VALUE_CLASS[metric.state]}`}>
        {metric.value}
      </p>
      <p className="text-xs text-ink-muted">{metric.caption}</p>
      {metric.comparison === null ? (
        <p className="text-xs text-ink-faint">sem semana anterior para comparar</p>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-ink-muted">
          <Arrow aria-hidden className="size-3.5 shrink-0" />
          <span className="numeric">
            {metric.comparison.from} → {metric.value}
          </span>
          <span>
            {metric.comparison.better ? "melhor" : "pior"} {previousLabel(days)}
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * Week against week, in the three numbers the owner acts on.
 *
 * Each cell says the same three things in the same order: the number now, what
 * it means in words, and where it came from. "26 pontos abaixo" forces the
 * reader to reconstruct the previous value; "52% → 26%" hands it over.
 */
export function WeeklyComparison({
  summary,
  problemShare,
  previous,
  days,
}: WeeklyComparisonProps) {
  const blocked = summary.needsCorrection + summary.reviewRequired;

  const metrics: readonly Metric[] = [
    {
      label: "Guias verificadas",
      value: String(summary.total),
      state: "neutral",
      caption: `${summary.readyToSubmit} saíram limpas, ${blocked} travaram`,
      comparison:
        previous === null
          ? null
          : {
              from: String(previous.guidesChecked),
              better: summary.total >= previous.guidesChecked,
            },
    },
    {
      label: "Com problema",
      value: percent(problemShare),
      state: problemShare === 0 ? "good" : "bad",
      caption:
        problemShare === 0
          ? "nenhuma guia travada no período"
          : `${blocked} de ${summary.total} guias não podem ser enviadas`,
      comparison:
        previous === null
          ? null
          : {
              from: percent(previous.problemShare),
              better: problemShare <= previous.problemShare,
            },
    },
    {
      label: "Valor em risco",
      value: formatBrl(summary.amountAtRisk),
      state: summary.amountAtRisk === 0 ? "good" : "bad",
      caption:
        summary.amountAtRisk === 0
          ? "nada deixa de ser faturado"
          : `de ${formatBrl(summary.amountBilled)} faturáveis no período`,
      comparison:
        previous === null
          ? null
          : {
              from: formatBrl(previous.amountAtRisk),
              better: summary.amountAtRisk <= previous.amountAtRisk,
            },
    },
  ];

  return (
    <Card>
      <CardHeader
        title={days === 7 ? "Esta semana contra a anterior" : "Este período contra o anterior"}
        description={`Mesma janela de ${days} dias, por data de atendimento.`}
      />
      <CardBody className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {metrics.map((metric) => (
          <Trend key={metric.label} metric={metric} days={days} />
        ))}
      </CardBody>
    </Card>
  );
}
