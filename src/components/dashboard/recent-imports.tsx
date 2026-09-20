import type { ImportRecord } from "@/application/ports/import-repository.port";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable, TableCell, TableHead, TableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";

const COLUMNS = ["Origem", "Arquivo", "Lidas", "Importadas", "Rejeitadas", "Quando"] as const;

const SOURCE_LABELS: Readonly<Record<ImportRecord["source"], string>> = {
  CSV: "Upload CSV",
  API: "REST API",
  SEED: "Carga inicial",
  REVALIDATION: "Reavaliação pelas regras vigentes",
};

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

export function RecentImports({ imports }: { readonly imports: readonly ImportRecord[] }) {
  return (
    <Card>
      <CardHeader title="Importações recentes" description="Origem de cada lote de guias." />
      {imports.length === 0 ? (
        <EmptyState
          title="Nenhuma importação ainda"
          description="Use a página Importar para carregar uma exportação do sistema de gestão."
        />
      ) : (
        <DataTable>
          <TableHead columns={COLUMNS} />
          <tbody>
            {imports.map((record) => (
              <TableRow key={record.id}>
                <TableCell>{SOURCE_LABELS[record.source]}</TableCell>
                <TableCell className="text-ink-muted">{record.fileName ?? "-"}</TableCell>
                <TableCell className="numeric">{record.rowsRead}</TableCell>
                <TableCell className="numeric">{record.rowsImported}</TableCell>
                <TableCell className="numeric">{record.rowsRejected}</TableCell>
                <TableCell className="numeric text-ink-muted">
                  {formatDateTime(record.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </tbody>
        </DataTable>
      )}
    </Card>
  );
}
