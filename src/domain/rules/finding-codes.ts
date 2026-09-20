import type { RequiredFieldName } from "@/domain/conventions/convention.types";

/**
 * Stable identifiers for every problem the preflight can report. They are part
 * of the public contract (REST, MCP, exported CSV) — rename a code and every
 * downstream consumer breaks, so codes are append-only.
 */
export const FINDING_CODES = [
  "AUTHORIZATION_NUMBER_MISSING",
  "AUTHORIZATION_EXPIRY_MISSING",
  "PROFESSIONAL_REGISTRATION_MISSING",
  "MEMBERSHIP_NUMBER_MISSING",
  "CID_MISSING",
  "AUTHORIZATION_EXPIRED",
  "AUTHORIZATION_WINDOW_EXCEEDED",
  "AUTHORIZATION_SESSION_LIMIT_EXCEEDED",
  "CONVENTION_SESSION_LIMIT_EXCEEDED",
  "AUTHORIZATION_LIMIT_ABOVE_CONVENTION_MAX",
  "SESSION_NUMBER_MISSING",
  "SUBMISSION_DEADLINE_EXCEEDED",
  "UNKNOWN_CONVENTION",
  "UNKNOWN_PROCEDURE",
  "PROCEDURE_NOT_COVERED",
  "PROCEDURE_DESCRIPTION_MISMATCH",
  "AMOUNT_MISSING",
  "AMOUNT_DIFFERS_FROM_REFERENCE",
  "NEW_AUTHORIZATION_NOT_REGISTERED",
  "PRIVATE_BILLING_REQUESTED",
  "VERBAL_AUTHORIZATION_PENDING_NUMBER",
  "PROCEDURE_CONTRADICTED_BY_NOTE",
  "NOTE_REQUIRES_HUMAN_REVIEW",
  "SESSION_RESCHEDULED_NOTE",
] as const;

export type FindingCode = (typeof FINDING_CODES)[number];

/** Short, operator-facing label used to group problems in the dashboard. */
const FINDING_LABELS: Readonly<Record<FindingCode, string>> = {
  AUTHORIZATION_NUMBER_MISSING: "Autorização sem número",
  AUTHORIZATION_EXPIRY_MISSING: "Autorização sem validade",
  PROFESSIONAL_REGISTRATION_MISSING: "Profissional sem registro",
  MEMBERSHIP_NUMBER_MISSING: "Carteirinha ausente",
  CID_MISSING: "CID ausente",
  AUTHORIZATION_EXPIRED: "Autorização vencida",
  AUTHORIZATION_WINDOW_EXCEEDED: "Autorização acima da validade máxima",
  AUTHORIZATION_SESSION_LIMIT_EXCEEDED: "Sessão além da autorização",
  CONVENTION_SESSION_LIMIT_EXCEEDED: "Sessão além do limite do convênio",
  AUTHORIZATION_LIMIT_ABOVE_CONVENTION_MAX: "Autorização acima do limite do convênio",
  SESSION_NUMBER_MISSING: "Número da sessão ausente",
  SUBMISSION_DEADLINE_EXCEEDED: "Prazo de envio estourado",
  UNKNOWN_CONVENTION: "Convênio desconhecido",
  UNKNOWN_PROCEDURE: "Procedimento desconhecido",
  PROCEDURE_NOT_COVERED: "Procedimento não coberto",
  PROCEDURE_DESCRIPTION_MISMATCH: "Descrição divergente do código",
  AMOUNT_MISSING: "Valor ausente",
  AMOUNT_DIFFERS_FROM_REFERENCE: "Valor divergente da tabela",
  NEW_AUTHORIZATION_NOT_REGISTERED: "Nova autorização não lançada",
  PRIVATE_BILLING_REQUESTED: "Paciente pediu faturamento particular",
  VERBAL_AUTHORIZATION_PENDING_NUMBER: "Autorização verbal sem número",
  PROCEDURE_CONTRADICTED_BY_NOTE: "Observação contradiz o procedimento",
  NOTE_REQUIRES_HUMAN_REVIEW: "Observação exige leitura humana",
  SESSION_RESCHEDULED_NOTE: "Sessão remarcada",
};

const KNOWN_CODES: ReadonlySet<string> = new Set(FINDING_CODES);

export function isFindingCode(value: string): value is FindingCode {
  return KNOWN_CODES.has(value);
}

/**
 * Codes are read back from the database, where a row written by an older
 * release may carry a code this build no longer knows. Showing the raw code
 * keeps an old decision readable instead of crashing the page that renders it.
 */
export function findingLabel(code: string): string {
  return isFindingCode(code) ? FINDING_LABELS[code] : code;
}

/**
 * Each convention-required field gets its own code rather than a generic
 * `REQUIRED_FIELD_MISSING`, so consumers can act on a specific gap without
 * parsing a message.
 */
export const REQUIRED_FIELD_CODES: Readonly<Record<RequiredFieldName, FindingCode>> = {
  numero_autorizacao: "AUTHORIZATION_NUMBER_MISSING",
  autorizacao_validade: "AUTHORIZATION_EXPIRY_MISSING",
  profissional_registro: "PROFESSIONAL_REGISTRATION_MISSING",
  carteirinha: "MEMBERSHIP_NUMBER_MISSING",
  cid: "CID_MISSING",
};
