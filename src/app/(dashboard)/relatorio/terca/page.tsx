import { TriangleAlert } from "lucide-react";
import { z } from "zod";

import { findAttentionPoint } from "@/application/reports/attention-point";
import {
  DEFAULT_PERIOD_DAYS,
  MAX_PERIOD_DAYS,
  PERIOD_PRESETS,
  getPeriodReport,
  type ReportQuery,
} from "@/application/reports/get-period-report.use-case";
import { ConventionRanking } from "@/components/dashboard/convention-ranking";
import { PortfolioVerdict } from "@/components/dashboard/portfolio-verdict";
import { ProblemDistribution } from "@/components/dashboard/problem-distribution";
import { UnitBreakdown } from "@/components/dashboard/unit-breakdown";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { ReportFilters, type PeriodPreset } from "@/components/reports/report-filters";
import { WeeklyComparison } from "@/components/reports/weekly-comparison";
import { WeeklyReadout } from "@/components/reports/weekly-readout";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CLINIC_UNITS } from "@/domain/guides/guide.types";
import { requireUser } from "@/infrastructure/auth/guards";
import { appServices } from "@/infrastructure/composition-root";
import { formatBrazilianDate, toIsoDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const metadata = { title: "Relatório executivo" };

/**
 * Filters arrive from the URL and are parsed with the same rigour as an API
 * payload: a hand-edited unit is ignored, not trusted, and a window longer
 * than a year is clamped by the use case.
 */
const searchParamsSchema = z.object({
  dias: z.coerce.number().int().positive().max(MAX_PERIOD_DAYS).optional().catch(undefined),
  de: z.string().transform(toIsoDate).nullable().optional().catch(undefined),
  ate: z.string().transform(toIsoDate).nullable().optional().catch(undefined),
  unidade: z.enum(CLINIC_UNITS).optional().catch(undefined),
  convenio: z.string().min(1).optional().catch(undefined),
});

/** Rebuilds the current link with one window length swapped in. */
function presetHref(days: number, scope: { unit?: string; convention?: string }): string {
  const params = new URLSearchParams({ dias: String(days) });
  if (scope.unit !== undefined) params.set("unidade", scope.unit);
  if (scope.convention !== undefined) params.set("convenio", scope.convention);
  return `/relatorio/terca?${params.toString()}`;
}

function scopeSuffix(unit: string | null, convention: string | null): string {
  const parts = [
    unit === null ? null : `unidade ${unit}`,
    convention === null ? null : `convênio ${convention}`,
  ].filter((part) => part !== null);

  return parts.length === 0 ? "" : `, ${parts.join(" e ")}`;
}

/**
 * The owner's report.
 *
 * It opens with the verdict and the money, because that is what the owner came
 * for; the comparison, the reading, the causes and the conventions are the
 * follow-up questions, in the order they get asked. Every number on the screen
 * answers for the window and the slice named at the top.
 */
export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = searchParamsSchema.parse(await searchParams);

  const services = await appServices();
  await requireUser(services.access, "/relatorio/terca");

  const from = parsed.de ?? null;
  const through = parsed.ate ?? null;
  // Two dates state a window of their own; a single date only moves the end of
  // the preset window.
  const customRange = from !== null && through !== null;

  const query: ReportQuery = {
    ...(customRange ? { from } : {}),
    ...(through === null ? {} : { through }),
    ...(parsed.dias === undefined || customRange ? {} : { days: parsed.dias }),
    ...(parsed.unidade === undefined ? {} : { unit: parsed.unidade }),
    ...(parsed.convenio === undefined ? {} : { convention: parsed.convenio }),
  };

  const report = await getPeriodReport(services.guides, query);
  const conventions = [...services.ruleSet.conventions.values()].map(
    (convention) => convention.name,
  );

  const presets: readonly PeriodPreset[] = PERIOD_PRESETS.map((days) => ({
    days,
    href: presetHref(days, {
      ...(parsed.unidade === undefined ? {} : { unit: parsed.unidade }),
      ...(parsed.convenio === undefined ? {} : { convention: parsed.convenio }),
    }),
    active: (parsed.dias ?? DEFAULT_PERIOD_DAYS) === days,
  }));

  if (report === null) {
    return (
      <>
        <PageHeader title="Relatório executivo" description="Resumo do preflight por período." />
        <PageContent>
          <Card>
            <EmptyState
              title="Ainda não há dados"
              description="Importe uma exportação de guias para gerar o primeiro relatório."
            />
          </Card>
        </PageContent>
      </>
    );
  }

  const { summary, period, previous, scope } = report;
  const attention = findAttentionPoint(summary);
  const window = `${formatBrazilianDate(period.from)} a ${formatBrazilianDate(period.through)}`;
  const suffix = scopeSuffix(scope.unit, scope.convention);

  const queueParams = new URLSearchParams({
    status: "NEEDS_CORRECTION",
    from: period.from,
    through: period.through,
  });
  if (scope.unit !== null) queueParams.set("unit", scope.unit);
  if (scope.convention !== null) queueParams.set("convention", scope.convention);

  return (
    <>
      <PageHeader
        title="Relatório executivo"
        description={`Período de ${window}${suffix}, por data de atendimento. Cada número abaixo é calculado sobre as guias desse recorte.`}
      />

      <PageContent>
        <ReportFilters
          presets={presets}
          conventions={conventions}
          selected={{
            days: report.days,
            from: period.from,
            through: period.through,
            customRange,
            ...(scope.unit === null ? {} : { unit: scope.unit }),
            ...(scope.convention === null ? {} : { convention: scope.convention }),
          }}
        />

        <PortfolioVerdict
          summary={summary}
          scope={`${report.days} dias: ${window}${suffix}`}
          footnote={`Estes números são só deste recorte. Sob o mesmo filtro há ${report.portfolioGuides} guias verificadas no total.`}
          actionHref={`/guias?${queueParams.toString()}`}
          actionLabel="Ver as travadas deste período"
        />

        <WeeklyComparison
          summary={summary}
          problemShare={report.problemShare}
          previous={previous}
          days={report.days}
        />

        {attention !== null && (
          <section className="rounded-[var(--radius-card)] border border-warn/30 bg-warn-soft px-5 py-4">
            <h2 className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-warn">
              <TriangleAlert aria-hidden className="size-3.5" />
              Principal ponto de atenção
            </h2>
            <p className="mt-2 text-base font-semibold leading-snug text-ink">
              {attention.headline}
            </p>
            <p className="mt-1 text-sm text-ink-muted">{attention.detail}</p>
          </section>
        )}

        <WeeklyReadout summary={summary} previous={previous} days={report.days} />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <ProblemDistribution problems={summary.topProblems} limit={5} />
          <UnitBreakdown units={summary.byUnit} />
        </div>

        <ConventionRanking conventions={summary.byConvention} totalGuides={summary.total} />
      </PageContent>
    </>
  );
}
