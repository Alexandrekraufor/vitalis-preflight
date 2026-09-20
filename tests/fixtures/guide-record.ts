import type { GuideColumn } from "@/domain/normalization/normalization.types";

/**
 * A guide as a caller writes it: column names, values as strings or numbers.
 * Typed rather than `unknown` so fixtures can be handed straight to the REST
 * payload and the MCP tool input without a cast.
 */
export type GuideRecordDraft = Partial<Record<GuideColumn, string | number | null>>;

const BASELINE: Record<GuideColumn, string> = {
  id_guia: "G-TEST-0001",
  unidade: "Centro",
  data_atendimento: "2026-08-20",
  paciente: "P-1000",
  convenio: "Vitalcard",
  carteirinha: "884410270",
  cid: "M79.7",
  procedimento_codigo: "50000470",
  procedimento_descricao: "Sessão de fisioterapia musculoesquelética",
  numero_autorizacao: "AUT100001",
  autorizacao_validade: "2026-08-31",
  autorizacao_sessoes_limite: "10",
  sessao_numero_na_autorizacao: "3",
  profissional: "Bruno Castanho",
  profissional_registro: "CREFITO-3 204411-F",
  valor: "62.00",
  observacao_recepcao: "",
  data_lancamento: "2026-08-21",
};

/**
 * A guide that passes every rule, so each test can introduce exactly one
 * problem and be sure the finding it asserts came from that change.
 */
export function aGuideRecord(overrides: GuideRecordDraft = {}): GuideRecordDraft {
  return { ...BASELINE, ...overrides };
}
