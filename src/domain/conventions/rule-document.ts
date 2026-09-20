import { createHash } from "node:crypto";

import { z } from "zod";

import { parseMoney, toDecimalString } from "@/lib/money";

import { conventionKey } from "./convention";
import type { Convention, Procedure, RuleSet } from "./convention.types";

/**
 * The rule set as a document: what a file holds, what the database stores and
 * what the editor writes.
 *
 * Keeping one schema for all three is what lets the clinic edit rules without
 * inventing a format the engine cannot read. A document that does not parse
 * here never becomes a rule set anywhere.
 */
export const REQUIRED_FIELD_NAMES = [
  "numero_autorizacao",
  "autorizacao_validade",
  "profissional_registro",
  "carteirinha",
  "cid",
] as const;

const REQUIRED_FIELD_LABELS: Readonly<Record<(typeof REQUIRED_FIELD_NAMES)[number], string>> = {
  numero_autorizacao: "Número da autorização",
  autorizacao_validade: "Validade da autorização",
  profissional_registro: "Registro do profissional",
  carteirinha: "Carteirinha",
  cid: "CID",
};

export function requiredFieldLabel(field: (typeof REQUIRED_FIELD_NAMES)[number]): string {
  return REQUIRED_FIELD_LABELS[field];
}

const money = z.string().transform((value, ctx) => {
  const amount = parseMoney(value);
  if (amount === null) {
    ctx.addIssue({ code: "custom", message: "valor_referencia inválido." });
    return z.NEVER;
  }
  return amount;
});

const procedureSchema = z.object({
  codigo: z.string().trim().min(1).max(40),
  descricao: z.string().trim().min(1).max(200),
  valor_referencia: money,
});

const conventionSchema = z.object({
  nome: z.string().trim().min(1).max(80),
  campos_obrigatorios: z.array(z.enum(REQUIRED_FIELD_NAMES)).min(1),
  validade_maxima_autorizacao_dias: z.int().positive().max(3650),
  limite_sessoes_por_autorizacao: z.int().positive().max(1000),
  procedimentos_cobertos: z.array(z.string().trim().min(1)).min(1),
  prazo_envio_dias: z.int().positive().max(3650),
  observacao: z.string().trim().min(1).max(600),
});

/**
 * Two checks the field types cannot make on their own: no duplicate keys, and
 * no convention covering a procedure the document does not define. Both would
 * parse fine and then behave as "unknown procedure" at validation time, which
 * is a silent wrong answer rather than a refused edit.
 */
export const ruleDocumentSchema = z
  .object({
    versao: z.string().trim().min(1).max(60),
    procedimentos: z.array(procedureSchema).min(1),
    convenios: z.array(conventionSchema).min(1),
  })
  .superRefine((document, ctx) => {
    const codes = document.procedimentos.map((procedure) => procedure.codigo);
    if (new Set(codes).size !== codes.length) {
      ctx.addIssue({
        code: "custom",
        path: ["procedimentos"],
        message: "Há códigos de procedimento repetidos.",
      });
    }

    const names = document.convenios.map((convention) => conventionKey(convention.nome));
    if (new Set(names).size !== names.length) {
      ctx.addIssue({
        code: "custom",
        path: ["convenios"],
        message: "Há convênios repetidos.",
      });
    }

    const known = new Set(codes);
    for (const [index, convention] of document.convenios.entries()) {
      const unknown = convention.procedimentos_cobertos.filter((code) => !known.has(code));
      if (unknown.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["convenios", index, "procedimentos_cobertos"],
          message: `Procedimento não cadastrado: ${unknown.join(", ")}.`,
        });
      }
    }
  });

/** The parsed document, with money already in cents. */
export type RuleDocument = z.infer<typeof ruleDocumentSchema>;

/** The document as it travels as JSON, with money as a decimal string. */
export interface RuleDocumentJson {
  readonly versao: string;
  readonly procedimentos: readonly {
    readonly codigo: string;
    readonly descricao: string;
    readonly valor_referencia: string;
  }[];
  readonly convenios: readonly {
    readonly nome: string;
    readonly campos_obrigatorios: readonly string[];
    readonly validade_maxima_autorizacao_dias: number;
    readonly limite_sessoes_por_autorizacao: number;
    readonly procedimentos_cobertos: readonly string[];
    readonly prazo_envio_dias: number;
    readonly observacao: string;
  }[];
}

export function toDocumentJson(document: RuleDocument): RuleDocumentJson {
  return {
    versao: document.versao,
    procedimentos: document.procedimentos.map((procedure) => ({
      codigo: procedure.codigo,
      descricao: procedure.descricao,
      valor_referencia: toDecimalString(procedure.valor_referencia),
    })),
    convenios: document.convenios.map((convention) => ({
      nome: convention.nome,
      campos_obrigatorios: [...convention.campos_obrigatorios],
      validade_maxima_autorizacao_dias: convention.validade_maxima_autorizacao_dias,
      limite_sessoes_por_autorizacao: convention.limite_sessoes_por_autorizacao,
      procedimentos_cobertos: [...convention.procedimentos_cobertos],
      prazo_envio_dias: convention.prazo_envio_dias,
      observacao: convention.observacao,
    })),
  };
}

/**
 * Stable serialization, so the hash answers "are these the same rules" and not
 * "was this file formatted the same way".
 */
export function serializeDocument(document: RuleDocument): string {
  return JSON.stringify(toDocumentJson(document), null, 2);
}

export function hashDocument(document: RuleDocument): string {
  return createHash("sha256").update(serializeDocument(document), "utf8").digest("hex");
}

/** Turns a parsed document into the immutable structure the engine reads. */
export function toRuleSet(document: RuleDocument, hash: string): RuleSet {
  const procedures = new Map<string, Procedure>(
    document.procedimentos.map((procedure) => [
      procedure.codigo,
      {
        code: procedure.codigo,
        description: procedure.descricao,
        referenceValue: procedure.valor_referencia,
      },
    ]),
  );

  const conventions = new Map<string, Convention>(
    document.convenios.map((convention) => [
      conventionKey(convention.nome),
      {
        name: convention.nome,
        requiredFields: convention.campos_obrigatorios,
        maxAuthorizationValidityDays: convention.validade_maxima_autorizacao_dias,
        maxSessionsPerAuthorization: convention.limite_sessoes_por_autorizacao,
        coveredProcedureCodes: convention.procedimentos_cobertos,
        submissionDeadlineDays: convention.prazo_envio_dias,
        note: convention.observacao,
      },
    ]),
  );

  return { version: document.versao, hash, procedures, conventions };
}

/** The reverse trip, so the editor can start from what is published. */
export function fromRuleSet(ruleSet: RuleSet): RuleDocument {
  return {
    versao: ruleSet.version,
    procedimentos: [...ruleSet.procedures.values()].map((procedure) => ({
      codigo: procedure.code,
      descricao: procedure.description,
      valor_referencia: procedure.referenceValue,
    })),
    convenios: [...ruleSet.conventions.values()].map((convention) => ({
      nome: convention.name,
      campos_obrigatorios: [...convention.requiredFields],
      validade_maxima_autorizacao_dias: convention.maxAuthorizationValidityDays,
      limite_sessoes_por_autorizacao: convention.maxSessionsPerAuthorization,
      procedimentos_cobertos: [...convention.coveredProcedureCodes],
      prazo_envio_dias: convention.submissionDeadlineDays,
      observacao: convention.note,
    })),
  };
}
