/** The 18 columns of the clinic's export, in the order the CSV declares them. */
export const GUIDE_COLUMNS = [
  "id_guia",
  "unidade",
  "data_atendimento",
  "paciente",
  "convenio",
  "carteirinha",
  "cid",
  "procedimento_codigo",
  "procedimento_descricao",
  "numero_autorizacao",
  "autorizacao_validade",
  "autorizacao_sessoes_limite",
  "sessao_numero_na_autorizacao",
  "profissional",
  "profissional_registro",
  "valor",
  "observacao_recepcao",
  "data_lancamento",
] as const;

export type GuideColumn = (typeof GUIDE_COLUMNS)[number];

/** Whatever arrived - from a CSV cell, a JSON body or an MCP tool argument. */
export type RawGuideRecord = Readonly<Partial<Record<GuideColumn, unknown>>>;

/** Same shape, after syntactic clean-up. Every value is a string or absent. */
export type NormalizedGuideRecord = Readonly<Record<GuideColumn, string | null>>;

export type NormalizationKind =
  | "TRIMMED_WHITESPACE"
  | "DATE_REFORMATTED"
  | "DECIMAL_SEPARATOR"
  | "EMPTY_TO_NULL";

/**
 * One auditable edit. Normalization never touches clinical or contractual
 * content, so every change here is purely a change of notation.
 */
export interface NormalizationChange {
  readonly field: GuideColumn;
  readonly kind: NormalizationKind;
  readonly from: string;
  readonly to: string | null;
  readonly reason: string;
}

export interface NormalizationOutcome {
  readonly record: NormalizedGuideRecord;
  readonly changes: readonly NormalizationChange[];
}
