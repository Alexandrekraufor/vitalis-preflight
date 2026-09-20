import Link from "next/link";

import type { GuideListItem } from "@/application/ports/guide-repository.port";
import { DataTable, TableCell, TableHead, TableRow } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatBrazilianDate } from "@/lib/dates";
import { formatBrl } from "@/lib/money";

const COLUMNS = [
  "Guia",
  "Unidade",
  "Convênio",
  "Paciente",
  "Procedimento",
  "Valor",
  "Status",
  "Problema principal",
  "Atendimento",
] as const;

interface GuidesTableProps {
  readonly guides: readonly GuideListItem[];
  readonly emptyTitle: string;
  readonly emptyDescription: string;
}

export function GuidesTable({ guides, emptyTitle, emptyDescription }: GuidesTableProps) {
  if (guides.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <DataTable>
      <TableHead columns={COLUMNS} />
      <tbody>
        {guides.map((guide) => (
          <TableRow key={guide.idGuia}>
            <TableCell>
              <Link
                href={`/guias/${guide.idGuia}`}
                className="font-medium text-accent underline-offset-2 hover:underline"
              >
                {guide.idGuia}
              </Link>
            </TableCell>
            <TableCell className="text-ink-muted">{guide.unit}</TableCell>
            <TableCell className="text-ink-muted">{guide.conventionName}</TableCell>
            <TableCell className="text-ink-muted">{guide.patient}</TableCell>
            <TableCell>
              <span className="numeric text-ink-muted">{guide.procedureCode}</span>
              <span className="sr-only">
                {guide.procedureDescription ?? "sem descrição"}
              </span>
            </TableCell>
            <TableCell className="numeric">
              {guide.amount === null ? "—" : formatBrl(guide.amount)}
            </TableCell>
            <TableCell>
              <StatusBadge status={guide.status} />
            </TableCell>
            <TableCell className="max-w-xs text-ink-muted">
              {guide.primaryFindingMessage ?? "—"}
            </TableCell>
            <TableCell className="numeric text-ink-muted">
              {formatBrazilianDate(guide.appointmentDate)}
            </TableCell>
          </TableRow>
        ))}
      </tbody>
    </DataTable>
  );
}
