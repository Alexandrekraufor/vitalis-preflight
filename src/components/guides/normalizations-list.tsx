import { Card, CardHeader } from "@/components/ui/card";
import { DataTable, TableCell, TableHead, TableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import type { NormalizationChange } from "@/domain/normalization/normalization.types";

const COLUMNS = ["Campo", "Antes", "Depois", "Motivo"] as const;

export function NormalizationsList({
  changes,
}: {
  readonly changes: readonly NormalizationChange[];
}) {
  return (
    <Card>
      <CardHeader
        title="Normalizações automáticas"
        description="Apenas notação foi ajustada. Conteúdo clínico e contratual nunca é reescrito."
      />
      {changes.length === 0 ? (
        <EmptyState
          title="Nenhuma normalização"
          description="A guia chegou no formato esperado e foi usada como veio."
        />
      ) : (
        <DataTable>
          <TableHead columns={COLUMNS} />
          <tbody>
            {changes.map((change, index) => (
              <TableRow key={`${change.field}-${index}`}>
                <TableCell className="font-medium">{change.field}</TableCell>
                <TableCell className="numeric text-ink-muted">{change.from}</TableCell>
                <TableCell className="numeric">{change.to ?? "-"}</TableCell>
                <TableCell className="text-ink-muted">{change.reason}</TableCell>
              </TableRow>
            ))}
          </tbody>
        </DataTable>
      )}
    </Card>
  );
}
