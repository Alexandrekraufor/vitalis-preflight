import { CsvImportForm } from "@/components/guides/csv-import-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { GUIDE_COLUMNS } from "@/domain/normalization/normalization.types";
import { requireUser } from "@/infrastructure/auth/guards";
import { appServices } from "@/infrastructure/composition-root";

export const dynamic = "force-dynamic";

export const metadata = { title: "Importar" };

export default async function ImportPage() {
  const services = await appServices();
  await requireUser(services.access, "/importar");

  return (
    <>
      <PageHeader
        title="Importar guias"
        description="Carregue a exportação do sistema de gestão. Cada guia é normalizada, validada e versionada."
      />

      <Card>
        <CardHeader
          title="Arquivo CSV"
          description="Guias já importadas são atualizadas por id_guia; reimportar o mesmo arquivo não duplica nada."
        />
        <CardBody>
          <CsvImportForm />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Colunas esperadas"
          description="A ordem não importa; os nomes sim. Datas em AAAA-MM-DD ou DD/MM/AAAA e valores com ponto ou vírgula são aceitos."
        />
        <CardBody>
          <ul className="flex flex-wrap gap-2">
            {GUIDE_COLUMNS.map((column) => (
              <li
                key={column}
                className="rounded bg-canvas px-2 py-1 font-mono text-xs text-ink-muted"
              >
                {column}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </>
  );
}
