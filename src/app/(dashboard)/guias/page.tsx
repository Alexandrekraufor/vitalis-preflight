import { z } from "zod";

import { listGuides } from "@/application/guides/list-guides.use-case";
import type { GuideListFilter } from "@/application/ports/guide-repository.port";
import { GuidesFilters } from "@/components/guides/guides-filters";
import { GuidesTable } from "@/components/guides/guides-table";
import { Card, CardHeader } from "@/components/ui/card";
import { PageContent } from "@/components/layout/page-content";
import { PageHeader } from "@/components/layout/page-header";
import { GUIDE_STATUSES } from "@/domain/guides/guide-status";
import { CLINIC_UNITS } from "@/domain/guides/guide.types";
import { requireUser } from "@/infrastructure/auth/guards";
import { appServices } from "@/infrastructure/composition-root";
import { toIsoDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const metadata = { title: "Guias" };

/**
 * Filters come from the URL and are parsed with the same rigour as an API
 * payload: an unknown status in a hand-edited link is ignored, not trusted.
 */
const searchParamsSchema = z.object({
  status: z.enum(GUIDE_STATUSES).optional().catch(undefined),
  unit: z.enum(CLINIC_UNITS).optional().catch(undefined),
  convention: z.string().min(1).optional().catch(undefined),
  search: z.string().min(1).optional().catch(undefined),
  // The executive report links here with its own week attached, so the list
  // shows exactly the guides that report counted.
  from: z.string().transform(toIsoDate).nullable().optional().catch(undefined),
  through: z.string().transform(toIsoDate).nullable().optional().catch(undefined),
});

export default async function GuidesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = searchParamsSchema.parse(raw);

  const filter: GuideListFilter = {
    ...(parsed.status === undefined ? {} : { status: parsed.status }),
    ...(parsed.unit === undefined ? {} : { unit: parsed.unit }),
    ...(parsed.convention === undefined ? {} : { conventionName: parsed.convention }),
    ...(parsed.search === undefined ? {} : { search: parsed.search }),
    ...(parsed.from === undefined || parsed.from === null ? {} : { from: parsed.from }),
    ...(parsed.through === undefined || parsed.through === null
      ? {}
      : { through: parsed.through }),
  };

  const services = await appServices();
  await requireUser(services.access, "/guias");

  const guides = await listGuides(filter, services.guides);
  const conventions = [...services.ruleSet.conventions.values()].map(
    (convention) => convention.name,
  );

  return (
    <>
      <PageHeader
        title="Guias"
        description="Todas as guias verificadas, com o resultado do preflight."
      />

      <PageContent>
        <Card>
          <CardHeader
            title={`${guides.length} ${guides.length === 1 ? "guia" : "guias"}`}
            description="Clique no identificador para ver o detalhe completo da decisão."
          />
          <GuidesFilters
            conventions={conventions}
            selected={{
              ...(parsed.status === undefined ? {} : { status: parsed.status }),
              ...(parsed.unit === undefined ? {} : { unit: parsed.unit }),
              ...(parsed.convention === undefined ? {} : { convention: parsed.convention }),
              ...(parsed.search === undefined ? {} : { search: parsed.search }),
            }}
          />
          <GuidesTable
            guides={guides}
            emptyTitle="Nenhuma guia encontrada"
            emptyDescription="Ajuste os filtros ou importe uma exportação do sistema de gestão."
          />
        </Card>
      </PageContent>
    </>
  );
}
