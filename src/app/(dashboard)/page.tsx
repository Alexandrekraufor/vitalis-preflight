import { Upload } from "lucide-react";
import Link from "next/link";

import { getOperationalSummary } from "@/application/reports/get-operational-summary.use-case";
import { ConventionRanking } from "@/components/dashboard/convention-ranking";
import { PortfolioVerdict } from "@/components/dashboard/portfolio-verdict";
import { ProblemDistribution } from "@/components/dashboard/problem-distribution";
import { RecentImports } from "@/components/dashboard/recent-imports";
import { UnitBreakdown } from "@/components/dashboard/unit-breakdown";
import { GuidesTable } from "@/components/guides/guides-table";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/infrastructure/auth/guards";
import { formatBrazilianDate } from "@/lib/dates";
import { appServices } from "@/infrastructure/composition-root";

export const dynamic = "force-dynamic";

export const metadata = { title: "Visão geral" };

/** The operations dashboard. Server-rendered: no guide data reaches the client. */
export default async function OverviewPage() {
  const services = await appServices();
  await requireUser(services.access, "/");

  const { summary, coverage, actionQueue, recentImports } = await getOperationalSummary(
    {},
    services,
  );

  // The dashboard counts everything on record; the executive report cuts one
  // week out of it. Both screens now say which set they are showing, in the
  // same words, so the two totals stop looking like a contradiction.
  const scope =
    coverage === null
      ? "Todas as guias importadas"
      : `Todas as guias importadas · atendimentos de ${formatBrazilianDate(coverage.from)} a ${formatBrazilianDate(coverage.through)}`;

  return (
    <>
      <PageHeader
        title="Visão geral"
        description="Situação das guias verificadas antes do envio aos convênios."
        action={
          <Link
            href="/importar"
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            <Upload aria-hidden className="size-4" />
            Importar guias
          </Link>
        }
      />

      <PageContent>
        <PortfolioVerdict
          summary={summary}
          scope={scope}
          footnote="Este é o acumulado de tudo que já foi importado. O relatório executivo mostra uma semana por vez, então os números de lá são sempre menores."
        />

        <Card>
          <CardHeader
            title="Comece por aqui"
            description="As guias travadas mais caras, da maior perda para a menor."
            action={
              <Link
                href="/guias?status=NEEDS_CORRECTION"
                className="text-sm font-medium text-brand underline-offset-2 hover:underline"
              >
                Ver todas
              </Link>
            }
          />
          <GuidesTable
            guides={actionQueue}
            emptyTitle="Nada pendente"
            emptyDescription="Nenhuma guia verificada está travada neste momento."
          />
        </Card>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <ProblemDistribution problems={summary.topProblems} />
          <UnitBreakdown units={summary.byUnit} />
        </div>

        <ConventionRanking conventions={summary.byConvention} totalGuides={summary.total} />

        <RecentImports imports={recentImports} />
      </PageContent>
    </>
  );
}
