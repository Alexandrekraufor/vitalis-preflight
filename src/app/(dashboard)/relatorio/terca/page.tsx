import { findAttentionPoint } from "@/application/reports/attention-point";
import { getWeeklyReport } from "@/application/reports/get-weekly-report.use-case";
import { PeriodPicker } from "@/components/reports/period-picker";
import { ProblemDistribution } from "@/components/dashboard/problem-distribution";
import { UnitBreakdown } from "@/components/dashboard/unit-breakdown";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { requireUser } from "@/infrastructure/auth/guards";
import { appServices } from "@/infrastructure/composition-root";
import { formatBrazilianDate, toIsoDate } from "@/lib/dates";
import { formatBrl } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata = { title: "Relatório executivo" };

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function describeChange(current: number, previous: number): string {
  const difference = Math.round((current - previous) * 100);
  if (difference === 0) return "igual à semana anterior";
  return difference > 0
    ? `${difference} pontos acima da semana anterior`
    : `${Math.abs(difference)} pontos abaixo da semana anterior`;
}

/**
 * The owner's report. Deliberately short: five numbers, the main causes, the
 * three units side by side, and one sentence of comparison.
 */
export default async function WeeklyReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const requested = (await searchParams)["through"];
  const through = typeof requested === "string" ? toIsoDate(requested) : null;

  const services = await appServices();
  await requireUser(services.access, "/relatorio/terca");

  const report = await getWeeklyReport(
    services.guides,
    through === null ? {} : { through },
  );

  if (report === null) {
    return (
      <>
        <PageHeader title="Relatório executivo" description="Resumo semanal do preflight." />
        <Card>
          <EmptyState
            title="Ainda não há dados"
            description="Importe uma exportação de guias para gerar o primeiro relatório."
          />
        </Card>
      </>
    );
  }

  const { summary, period, previous } = report;
  const attention = findAttentionPoint(summary);

  return (
    <>
      <PageHeader
        title="Relatório executivo"
        description={`Semana de ${formatBrazilianDate(period.from)} a ${formatBrazilianDate(period.through)}, por data de atendimento.`}
        action={<PeriodPicker through={period.through} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Guias analisadas" value={String(summary.total)} />
        <StatCard
          label="Com problema"
          value={percent(report.problemShare)}
          tone="warn"
          hint={
            previous === null
              ? "sem período anterior para comparar"
              : describeChange(report.problemShare, previous.problemShare)
          }
        />
        <StatCard
          label="Prontas para envio"
          value={String(summary.readyToSubmit)}
          tone="ready"
        />
        <StatCard
          label="Valor protegido"
          value={formatBrl(summary.amountProtected)}
          tone="ready"
          hint="Liberado sem risco de glosa"
        />
        <StatCard
          label="Valor em risco"
          value={formatBrl(summary.amountAtRisk)}
          tone="danger"
          hint={
            previous === null
              ? "sem período anterior"
              : `semana anterior: ${formatBrl(previous.amountAtRisk)}`
          }
        />
      </div>

      {attention !== null && (
        <section className="rounded-[var(--radius-card)] border border-warn/20 bg-warn-soft px-5 py-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-warn">
            Principal ponto de atenção
          </h2>
          <p className="mt-1.5 text-base font-medium leading-snug text-ink">
            {attention.headline}
          </p>
          <p className="mt-1 text-sm text-ink-muted">{attention.detail}</p>
        </section>
      )}

      <Card>
        <CardHeader title="Leitura da semana" />
        <CardBody>
          <p className="text-sm leading-relaxed text-ink">
            Foram verificadas {summary.total} guias. {summary.readyToSubmit} saíram prontas
            para envio, {summary.needsCorrection} precisam de correção e{" "}
            {summary.reviewRequired} exigem decisão humana.{" "}
            {summary.amountAtRisk > 0
              ? `${formatBrl(summary.amountAtRisk)} deixariam de ser faturados se essas guias fossem enviadas como estão.`
              : "Nenhum valor ficou em risco nesta semana."}
            {previous !== null &&
              ` Na semana anterior foram ${previous.guidesChecked} guias, com ${percent(previous.problemShare)} de problemas.`}
          </p>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProblemDistribution problems={summary.topProblems} limit={5} />
        <UnitBreakdown units={summary.byUnit} />
      </div>
    </>
  );
}
