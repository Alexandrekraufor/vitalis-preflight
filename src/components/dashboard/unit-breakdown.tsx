import type { UnitBreakdown as UnitBreakdownData } from "@/application/reports/portfolio-summary";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBrl } from "@/lib/money";

/**
 * The three units side by side, each as one bar of three parts.
 *
 * The comparison the owner actually makes is "which unit is worse", and that
 * is a question about proportion, so every bar is the same width and the
 * segments are shares of that unit's own total. Counts and money are written
 * out, not hidden in a tooltip.
 */
export function UnitBreakdown({ units }: { readonly units: readonly UnitBreakdownData[] }) {
  return (
    <Card>
      <CardHeader
        title="Resultado por unidade"
        description="Mesmas regras, resultados diferentes."
      />

      {units.length === 0 ? (
        <EmptyState
          title="Sem unidades para comparar"
          description="Importe guias para ver o resultado de cada unidade."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-4 px-5 py-4">
            {units.map((unit) => {
              const share = (count: number): string =>
                `${unit.total === 0 ? 0 : (count / unit.total) * 100}%`;
              const blocked = unit.needsCorrection + unit.reviewRequired;

              return (
                <li key={unit.unit} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-semibold text-ink">{unit.unit}</span>
                      {unit.topConvention !== null && (
                        <span className="text-xs text-ink-muted">
                          puxada por{" "}
                          <strong className="font-medium text-ink">
                            {unit.topConvention.convention}
                          </strong>{" "}
                          <span className="numeric">
                            ({Math.round(unit.topConvention.share * 100)}% das guias)
                          </span>
                        </span>
                      )}
                    </span>
                    <span className="numeric text-xs text-ink-muted">
                      {unit.total} verificadas · {blocked} travadas
                    </span>
                  </div>

                  <div
                    className="flex h-2.5 overflow-hidden rounded-full bg-canvas"
                    role="img"
                    aria-label={`${unit.unit}: ${unit.readyToSubmit} prontas, ${unit.needsCorrection} precisam corrigir, ${unit.reviewRequired} em revisão`}
                  >
                    <div className="bg-ready" style={{ width: share(unit.readyToSubmit) }} />
                    <div className="bg-danger" style={{ width: share(unit.needsCorrection) }} />
                    <div className="bg-review" style={{ width: share(unit.reviewRequired) }} />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <span className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-ink-muted">
                      <Tally tone="ready" label="prontas" value={unit.readyToSubmit} />
                      <Tally tone="danger" label="corrigir" value={unit.needsCorrection} />
                      <Tally tone="review" label="revisão" value={unit.reviewRequired} />
                    </span>
                    <span className="numeric text-xs font-medium text-warn">
                      {formatBrl(unit.amountAtRisk)} em risco
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

const DOT_CLASS = {
  ready: "bg-ready",
  danger: "bg-danger",
  review: "bg-review",
} as const;

function Tally({
  tone,
  label,
  value,
}: {
  readonly tone: keyof typeof DOT_CLASS;
  readonly label: string;
  readonly value: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`size-2 rounded-full ${DOT_CLASS[tone]}`} />
      <span className="numeric font-medium text-ink">{value}</span>
      {label}
    </span>
  );
}
