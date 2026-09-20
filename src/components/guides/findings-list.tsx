import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SeverityBadge } from "@/components/ui/status-badge";
import type { Finding } from "@/domain/rules/finding";
import { findingLabel } from "@/domain/rules/finding-codes";

const SOURCE_LABELS: Readonly<Record<Finding["source"], string>> = {
  CONVENTION_RULE: "Regra do convênio",
  REFERENCE_TABLE: "Tabela de referência",
  RECEPTION_NOTE: "Observação da recepção",
};

export function FindingsList({ findings }: { readonly findings: readonly Finding[] }) {
  return (
    <Card>
      <CardHeader
        title="Problemas encontrados"
        description="Cada item traz a regra aplicada, o esperado e o encontrado."
      />
      {findings.length === 0 ? (
        <EmptyState
          title="Nenhum problema"
          description="A guia passou por todas as regras vigentes sem pendências."
        />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {findings.map((finding, index) => (
            <li key={`${finding.code}-${index}`} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-ink">
                  {findingLabel(finding.code)}
                </span>
                <SeverityBadge severity={finding.severity} />
                <code className="numeric rounded bg-canvas px-1.5 py-0.5 text-xs text-ink-muted">
                  {finding.code}
                </code>
              </div>

              <p className="mt-1.5 text-sm leading-relaxed text-ink">{finding.message}</p>

              <dl className="mt-2.5 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                <Detail term="Origem" value={SOURCE_LABELS[finding.source]} />
                <Detail term="Campo" value={finding.field} />
                <Detail term="Esperado" value={finding.expected} />
                <Detail term="Encontrado" value={finding.actual} />
              </dl>

              {finding.evidence !== null && (
                <blockquote className="mt-2.5 border-l-2 border-border-subtle pl-3 text-xs italic text-ink-muted">
                  “{finding.evidence}”
                </blockquote>
              )}

              {finding.recommendedAction !== null && (
                <p className="mt-2.5 text-xs font-medium text-brand">
                  Próximo passo: {finding.recommendedAction}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Detail({ term, value }: { readonly term: string; readonly value: string | null }) {
  if (value === null) return null;

  return (
    <div className="flex gap-1.5">
      <dt className="shrink-0 text-ink-muted">{term}:</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
