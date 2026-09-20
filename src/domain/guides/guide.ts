import { z } from "zod";

import { toIsoDate } from "@/lib/dates";
import { parseMoney, toDecimalString } from "@/lib/money";
import { normalizeGuideRecord } from "@/domain/normalization/normalize-guide";
import type {
  NormalizationChange,
  NormalizedGuideRecord,
  RawGuideRecord,
} from "@/domain/normalization/normalization.types";
import { err, ok, type Result } from "@/lib/result";

import { CLINIC_UNITS, type NormalizedGuide } from "./guide.types";

const requiredText = z.string().min(1);
const optionalText = z.string().min(1).nullable();

const isoDate = z.string().transform((value, ctx) => {
  const date = toIsoDate(value);
  if (date === null) {
    ctx.addIssue({ code: "custom", message: "Data inválida; use o formato AAAA-MM-DD." });
    return z.NEVER;
  }
  return date;
});

const money = z.string().transform((value, ctx) => {
  const amount = parseMoney(value);
  if (amount === null) {
    ctx.addIssue({ code: "custom", message: "Valor monetário inválido." });
    return z.NEVER;
  }
  return amount;
});

const wholeNumber = z.string().transform((value, ctx) => {
  if (!/^\d+$/.test(value)) {
    ctx.addIssue({ code: "custom", message: "Esperado um número inteiro não negativo." });
    return z.NEVER;
  }
  return Number(value);
});

const unit = z.string().transform((value, ctx) => {
  const match = CLINIC_UNITS.find(
    (candidate) => candidate.toLowerCase() === value.toLowerCase(),
  );
  if (match === undefined) {
    ctx.addIssue({
      code: "custom",
      message: `Unidade desconhecida. Esperado: ${CLINIC_UNITS.join(", ")}.`,
    });
    return z.NEVER;
  }
  return match;
});

/**
 * Structural contract of a normalized guide record. It rejects data that cannot
 * be reasoned about at all; everything that is merely *wrong* — an unknown
 * convention, a missing CID, an expired authorization — is left to the rule
 * engine so the caller gets a finding instead of a parse error.
 */
const normalizedGuideSchema = z
  .object({
    id_guia: requiredText,
    unidade: unit,
    data_atendimento: isoDate,
    paciente: requiredText,
    convenio: requiredText,
    carteirinha: optionalText,
    cid: optionalText,
    procedimento_codigo: requiredText,
    procedimento_descricao: optionalText,
    numero_autorizacao: optionalText,
    autorizacao_validade: isoDate.nullable(),
    autorizacao_sessoes_limite: wholeNumber.nullable(),
    sessao_numero_na_autorizacao: wholeNumber.nullable(),
    profissional: optionalText,
    profissional_registro: optionalText,
    valor: money.nullable(),
    observacao_recepcao: optionalText,
    data_lancamento: isoDate.nullable(),
  })
  .transform(
    (row): NormalizedGuide => ({
      idGuia: row.id_guia,
      unit: row.unidade,
      appointmentDate: row.data_atendimento,
      patient: row.paciente,
      conventionName: row.convenio,
      membershipNumber: row.carteirinha,
      cid: row.cid,
      procedureCode: row.procedimento_codigo,
      procedureDescription: row.procedimento_descricao,
      authorizationNumber: row.numero_autorizacao,
      authorizationValidThrough: row.autorizacao_validade,
      authorizationSessionLimit: row.autorizacao_sessoes_limite,
      sessionNumber: row.sessao_numero_na_autorizacao,
      professional: row.profissional,
      professionalRegistration: row.profissional_registro,
      amount: row.valor,
      receptionNote: row.observacao_recepcao,
      enteredAt: row.data_lancamento,
    }),
  );

export interface GuideStructuralIssue {
  readonly field: string;
  readonly message: string;
}

export interface ParsedGuide {
  readonly guide: NormalizedGuide;
  readonly normalizations: readonly NormalizationChange[];
}

/**
 * The single entry point every channel (CSV, REST, MCP) uses to turn raw input
 * into a guide the rule engine can evaluate.
 */
export function parseGuide(
  raw: RawGuideRecord,
): Result<ParsedGuide, readonly GuideStructuralIssue[]> {
  const { record, changes } = normalizeGuideRecord(raw);
  const parsed = normalizedGuideSchema.safeParse(record);

  if (!parsed.success) {
    return err(
      parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "(raiz)",
        message: issue.message,
      })),
    );
  }

  return ok({ guide: parsed.data, normalizations: changes });
}

/**
 * Inverse of `parseGuide`: renders a typed guide back into the 18-column record
 * the clinic works with. Used for content hashing, CSV export and anywhere the
 * original column names have to be spoken — so that mapping exists exactly once.
 */
export function toGuideRecord(guide: NormalizedGuide): NormalizedGuideRecord {
  return {
    id_guia: guide.idGuia,
    unidade: guide.unit,
    data_atendimento: guide.appointmentDate,
    paciente: guide.patient,
    convenio: guide.conventionName,
    carteirinha: guide.membershipNumber,
    cid: guide.cid,
    procedimento_codigo: guide.procedureCode,
    procedimento_descricao: guide.procedureDescription,
    numero_autorizacao: guide.authorizationNumber,
    autorizacao_validade: guide.authorizationValidThrough,
    autorizacao_sessoes_limite:
      guide.authorizationSessionLimit === null
        ? null
        : String(guide.authorizationSessionLimit),
    sessao_numero_na_autorizacao:
      guide.sessionNumber === null ? null : String(guide.sessionNumber),
    profissional: guide.professional,
    profissional_registro: guide.professionalRegistration,
    valor: guide.amount === null ? null : toDecimalString(guide.amount),
    observacao_recepcao: guide.receptionNote,
    data_lancamento: guide.enteredAt,
  };
}
