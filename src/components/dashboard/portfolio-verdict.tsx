import { ArrowRight, CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";

import type { PortfolioSummary } from "@/application/reports/portfolio-summary";
import { formatBrl } from "@/lib/money";

interface PortfolioVerdictProps {
  readonly summary: PortfolioSummary;
  /** Sits above the headline: which set of guides this is about. */
  readonly scope: string;
  /**
   * One line saying how this set relates to the other screen's. The dashboard
   * and the report count different sets on purpose, and a reader who is not
   * told that reads it as contradictory data.
   */
  readonly footnote?: string;
  /** Where "work the queue" goes. Defaults to every blocked guide. */
  readonly actionHref?: string;
  readonly actionLabel?: string;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

const FIGURE_TONE = {
  total: "text-ink",
  ready: "text-ready",
  danger: "text-danger",
} as const;

function Figure({
  label,
  value,
  tone,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly tone: keyof typeof FIGURE_TONE;
  readonly hint?: string;
}) {
  return (
    <div>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p className={`numeric mt-1 text-2xl font-bold tracking-tight ${FIGURE_TONE[tone]}`}>
        {value}
      </p>
      {hint !== undefined && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

function Segment({
  count,
  total,
  label,
  className,
}: {
  readonly count: number;
  readonly total: number;
  readonly label: string;
  readonly className: string;
}) {
  if (count === 0) return null;

  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{ width: `${(count / total) * 100}%` }}
      title={`${count} ${label}`}
    >
      <span className="numeric truncate px-2 text-[0.6875rem] font-bold text-white">{count}</span>
    </div>
  );
}

/**
 * The answer to "how are we doing", before any chart.
 *
 * One sentence states the situation, three figures say what it is worth, and a
 * single bar shows the split. Everything a reader needs for the first decision
 * of the day is above the fold and already in words - no legend to decode and
 * nothing to hover.
 */
export function PortfolioVerdict({
  summary,
  scope,
  footnote,
  actionHref = "/guias?status=NEEDS_CORRECTION",
  actionLabel = "Trabalhar as pendências",
}: PortfolioVerdictProps) {
  const blocked = summary.needsCorrection + summary.reviewRequired;
  const clear = blocked === 0 && summary.total > 0;

  const headline =
    summary.total === 0
      ? "Nenhuma guia verificada ainda"
      : clear
        ? `${summary.total} ${plural(summary.total, "guia pronta", "guias prontas")} para envio`
        : `${blocked} ${plural(blocked, "guia travada", "guias travadas")} antes do envio`;

  const detail =
    summary.total === 0
      ? "Importe uma exportação do sistema de gestão para rodar o preflight."
      : clear
        ? "Nenhum problema nas regras vigentes. Pode faturar."
        : `${formatBrl(summary.amountAtRisk)} deixam de ser faturados se essas guias forem enviadas como estão.`;

  return (
    <section
      className={`overflow-hidden rounded-[var(--radius-card)] border bg-surface shadow-premium ${
        clear ? "border-ready/30" : "border-border-subtle"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-6 px-5 py-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
            {clear ? (
              <CircleCheck aria-hidden className="size-3.5 text-ready" />
            ) : (
              <TriangleAlert aria-hidden className="size-3.5 text-warn" />
            )}
            {scope}
          </p>
          <p className="mt-2 text-2xl font-bold leading-tight tracking-tight text-ink">
            {headline}
          </p>
          <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-ink-muted">{detail}</p>

          {blocked > 0 && (
            <Link
              href={actionHref}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              {actionLabel}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          )}
        </div>

        {summary.total > 0 && (
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            <Figure
              label="Valor total do período"
              value={formatBrl(summary.amountBilled)}
              tone="total"
              hint={`${summary.total} guias faturáveis`}
            />
            <Figure
              label="Liberado"
              value={formatBrl(summary.amountProtected)}
              tone="ready"
              hint={`${summary.readyToSubmit} prontas para envio`}
            />
            <Figure
              label="Em risco"
              value={formatBrl(summary.amountAtRisk)}
              tone="danger"
              hint={blocked === 0 ? "nada travado" : `${blocked} travadas`}
            />
          </div>
        )}
      </div>

      {summary.total > 0 && (
        <div className="border-t border-border-subtle px-5 py-4">
          <div className="flex h-6 overflow-hidden rounded-md bg-canvas">
            <Segment
              count={summary.readyToSubmit}
              total={summary.total}
              label="prontas para envio"
              className="bg-ready"
            />
            <Segment
              count={summary.needsCorrection}
              total={summary.total}
              label="precisam corrigir"
              className="bg-danger"
            />
            <Segment
              count={summary.reviewRequired}
              total={summary.total}
              label="precisam de revisão humana"
              className="bg-review"
            />
          </div>

          <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-ready" />
              <strong className="numeric font-semibold text-ink">{summary.readyToSubmit}</strong>
              prontas para envio
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-danger" />
              <strong className="numeric font-semibold text-ink">{summary.needsCorrection}</strong>
              precisam corrigir
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-review" />
              <strong className="numeric font-semibold text-ink">{summary.reviewRequired}</strong>
              revisão humana
            </span>
            <span className="ml-auto numeric">{summary.total} verificadas neste recorte</span>
          </div>

          {footnote !== undefined && (
            <p className="mt-3 border-t border-border-subtle pt-3 text-xs leading-relaxed text-ink-muted">
              {footnote}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
