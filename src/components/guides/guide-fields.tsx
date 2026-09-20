import { Card, CardHeader } from "@/components/ui/card";
import { toGuideRecord } from "@/domain/guides/guide";
import type { NormalizedGuide } from "@/domain/guides/guide.types";
import { GUIDE_COLUMNS, type GuideColumn } from "@/domain/normalization/normalization.types";

const FIELD_LABELS: Readonly<Record<GuideColumn, string>> = {
  id_guia: "Identificador",
  unidade: "Unidade",
  data_atendimento: "Data do atendimento",
  paciente: "Paciente",
  convenio: "Convênio",
  carteirinha: "Carteirinha",
  cid: "CID",
  procedimento_codigo: "Código do procedimento",
  procedimento_descricao: "Descrição do procedimento",
  numero_autorizacao: "Número da autorização",
  autorizacao_validade: "Validade da autorização",
  autorizacao_sessoes_limite: "Sessões na autorização",
  sessao_numero_na_autorizacao: "Esta sessão",
  profissional: "Profissional",
  profissional_registro: "Registro do profissional",
  valor: "Valor",
  observacao_recepcao: "Observação da recepção",
  data_lancamento: "Lançada no sistema em",
};

/** The guide as stored, after normalization — the data the rules were run on. */
export function GuideFields({ guide }: { readonly guide: NormalizedGuide }) {
  const record = toGuideRecord(guide);

  return (
    <Card>
      <CardHeader title="Dados da guia" description="Valores normalizados usados na validação." />
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 px-5 py-4 sm:grid-cols-2">
        {GUIDE_COLUMNS.map((column) => (
          <div key={column} className="flex flex-col gap-0.5">
            <dt className="text-xs text-ink-muted">{FIELD_LABELS[column]}</dt>
            <dd className="text-sm text-ink">
              {record[column] ?? <span className="text-ink-muted">não informado</span>}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
