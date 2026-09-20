import { AlertTriangle, CheckCircle2, FileCheck2, HelpCircle, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { getOperationalSummary } from "@/application/reports/get-operational-summary.use-case";
import { ProblemDistribution } from "@/components/dashboard/problem-distribution";
import { RecentImports } from "@/components/dashboard/recent-imports";
import { UnitBreakdown } from "@/components/dashboard/unit-breakdown";
import { GuidesTable } from "@/components/guides/guides-table";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { requireUser } from "@/infrastructure/auth/guards";
import { appServices } from "@/infrastructure/composition-root";
import { formatBrl } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata = { title: "Visão geral" };

/** The operations dashboard. Server-rendered: no guide data reaches the client. */
export default async function OverviewPage() {
  const services = await appServices();
  await requireUser(services.access, "/");

  const { summary, actionQueue, recentImports } = await getOperationalSummary({}, services);

  return (
    <>
      <PageHeader
        title="Visão geral"
        description="Situação das guias verificadas antes do envio aos convênios."
        action={
          <Link
            href="/importar"
            className="rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            Importar guias
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Guias verificadas"
          value={String(summary.total)}
          icon={FileCheck2}
          hint={`Regras ${summary.total === 0 ? "não aplicadas" : "aplicadas a todas"}`}
        />
        <StatCard
          label="Prontas para envio"
          value={String(summary.readyToSubmit)}
          tone="ready"
          icon={CheckCircle2}
          hint={`${formatBrl(summary.amountProtected)} liberados`}
        />
        <StatCard
          label="Precisam corrigir"
          value={String(summary.needsCorrection)}
          tone="danger"
          icon={AlertTriangle}
          hint="Problema objetivo antes do envio"
        />
        <StatCard
          label="Revisão humana"
          value={String(summary.reviewRequired)}
          tone="review"
          icon={HelpCircle}
          hint="Dados contraditórios ou ambíguos"
        />
        <StatCard
          label="Valor em risco"
          value={formatBrl(summary.amountAtRisk)}
          tone="warn"
          icon={ShieldAlert}
          hint="Soma das guias que não podem sair"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProblemDistribution problems={summary.topProblems} />
        <UnitBreakdown units={summary.byUnit} />
      </div>

      <Card>
        <CardHeader
          title="Guias que precisam de ação"
          description="Ordenadas pelo valor em risco — o que trabalhar primeiro."
          action={
            <Link
              href="/guias?status=NEEDS_CORRECTION"
              className="text-sm font-medium text-accent underline-offset-2 hover:underline"
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

      <RecentImports imports={recentImports} />
    </>
  );
}
