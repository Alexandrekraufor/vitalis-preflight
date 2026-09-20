import Link from "next/link";
import { notFound } from "next/navigation";

import { getGuide } from "@/application/guides/get-guide.use-case";
import { DecisionPanel } from "@/components/guides/decision-panel";
import { FindingsList } from "@/components/guides/findings-list";
import { GuideFields } from "@/components/guides/guide-fields";
import { NormalizationsList } from "@/components/guides/normalizations-list";
import { ValidationHistory } from "@/components/guides/validation-history";
import { WhyItFell } from "@/components/guides/why-it-fell";
import { PageHeader } from "@/components/ui/page-header";
import { explainDecision, recommendedActions } from "@/domain/guides/validation-result";
import { requireUser } from "@/infrastructure/auth/guards";
import { appServices } from "@/infrastructure/composition-root";
import { formatBrazilianDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Guia ${id}` };
}

export default async function GuideDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const services = await appServices();
  await requireUser(services.access, `/guias/${id}`);

  const detail = await getGuide(id, services.guides);

  if (detail === null) notFound();

  const { guide, latestRun, findings, normalizations, history } = detail;

  return (
    <>
      <PageHeader
        title={`Guia ${guide.idGuia}`}
        description={`${guide.conventionName} · Unidade ${guide.unit} · Atendimento em ${formatBrazilianDate(guide.appointmentDate)}`}
        action={
          <Link
            href="/guias"
            className="text-sm font-medium text-accent underline-offset-2 hover:underline"
          >
            Voltar para a lista
          </Link>
        }
      />

      <DecisionPanel run={latestRun} recommendedActions={recommendedActions(findings)} />

      <WhyItFell reasons={explainDecision(findings)} />

      <FindingsList findings={findings} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <GuideFields guide={guide} />
        <div className="flex flex-col gap-4">
          <NormalizationsList changes={normalizations} />
          <ValidationHistory runs={history} />
        </div>
      </div>
    </>
  );
}
