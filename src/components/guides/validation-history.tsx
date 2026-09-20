import type { ValidationRunSummary } from "@/application/ports/guide-repository.port";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable, TableCell, TableHead, TableRow } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatBrl } from "@/lib/money";

const COLUMNS = ["Quando", "Versão da guia", "Decisão", "Valor em risco", "Regras", "Interpretação"] as const;

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    value,
  );
}

/** Every run this guide has been through, newest first. */
export function ValidationHistory({ runs }: { readonly runs: readonly ValidationRunSummary[] }) {
  return (
    <Card>
      <CardHeader
        title="Histórico de validações"
        description="Toda execução do motor fica registrada com a versão das regras usada."
      />
      <DataTable>
        <TableHead columns={COLUMNS} />
        <tbody>
          {runs.map((run) => (
            <TableRow key={run.id}>
              <TableCell className="numeric text-ink-muted">
                {formatDateTime(run.completedAt)}
              </TableCell>
              <TableCell className="numeric">v{run.versionNumber}</TableCell>
              <TableCell>
                <StatusBadge status={run.decision} />
              </TableCell>
              <TableCell className="numeric">{formatBrl(run.amountAtRisk)}</TableCell>
              <TableCell className="text-ink-muted">{run.rulesVersion}</TableCell>
              <TableCell className="text-ink-muted">
                {run.observationInterpreter === null
                  ? "sem observação"
                  : `${run.observationInterpreter}${run.observationModel === null ? "" : ` · ${run.observationModel}`}`}
              </TableCell>
            </TableRow>
          ))}
        </tbody>
      </DataTable>
    </Card>
  );
}
