import type { UnitBreakdown as UnitBreakdownData } from "@/application/reports/portfolio-summary";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable, TableCell, TableHead, TableRow } from "@/components/ui/data-table";
import { formatBrl } from "@/lib/money";

const COLUMNS = ["Unidade", "Verificadas", "Prontas", "Corrigir", "Revisão", "Em risco"] as const;

export function UnitBreakdown({ units }: { readonly units: readonly UnitBreakdownData[] }) {
  return (
    <Card>
      <CardHeader title="Resultado por unidade" description="Mesmas regras, resultados diferentes." />
      <DataTable>
        <TableHead columns={COLUMNS} />
        <tbody>
          {units.map((unit) => (
            <TableRow key={unit.unit}>
              <TableCell className="font-medium">{unit.unit}</TableCell>
              <TableCell className="numeric">{unit.total}</TableCell>
              <TableCell className="numeric text-ready">{unit.readyToSubmit}</TableCell>
              <TableCell className="numeric text-danger">{unit.needsCorrection}</TableCell>
              <TableCell className="numeric text-review">{unit.reviewRequired}</TableCell>
              <TableCell className="numeric whitespace-nowrap">{formatBrl(unit.amountAtRisk)}</TableCell>
            </TableRow>
          ))}
        </tbody>
      </DataTable>
    </Card>
  );
}
