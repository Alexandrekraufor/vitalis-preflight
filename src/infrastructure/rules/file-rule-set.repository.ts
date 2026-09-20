import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import type {
  Convention,
  Procedure,
  RuleSet,
} from "@/domain/conventions/convention.types";
import { conventionKey } from "@/domain/conventions/convention";
import { parseMoney } from "@/lib/money";

const REQUIRED_FIELD_NAMES = [
  "numero_autorizacao",
  "autorizacao_validade",
  "profissional_registro",
  "carteirinha",
  "cid",
] as const;

const money = z.string().transform((value, ctx) => {
  const amount = parseMoney(value);
  if (amount === null) {
    ctx.addIssue({ code: "custom", message: "valor_referencia inválido." });
    return z.NEVER;
  }
  return amount;
});

const ruleFileSchema = z.object({
  versao: z.string().min(1),
  procedimentos: z
    .array(
      z.object({
        codigo: z.string().min(1),
        descricao: z.string().min(1),
        valor_referencia: money,
      }),
    )
    .min(1),
  convenios: z
    .array(
      z.object({
        nome: z.string().min(1),
        campos_obrigatorios: z.array(z.enum(REQUIRED_FIELD_NAMES)).min(1),
        validade_maxima_autorizacao_dias: z.int().positive(),
        limite_sessoes_por_autorizacao: z.int().positive(),
        procedimentos_cobertos: z.array(z.string().min(1)).min(1),
        prazo_envio_dias: z.int().positive(),
        observacao: z.string().min(1),
      }),
    )
    .min(1),
});

export const DEFAULT_RULE_FILE = path.join(
  process.cwd(),
  "data",
  "source",
  "regras_convenio.json",
);

/**
 * Hash of the rule file's exact bytes. It travels with every decision so an
 * audit can tell "same version, edited file" from "same rules".
 */
function hashOf(contents: string): string {
  return createHash("sha256").update(contents, "utf8").digest("hex");
}

function toRuleSet(contents: string): RuleSet {
  const parsed = ruleFileSchema.safeParse(JSON.parse(contents));

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Arquivo de regras inválido:\n${issues}`);
  }

  const procedures = new Map<string, Procedure>(
    parsed.data.procedimentos.map((procedure) => [
      procedure.codigo,
      {
        code: procedure.codigo,
        description: procedure.descricao,
        referenceValue: procedure.valor_referencia,
      },
    ]),
  );

  const conventions = new Map<string, Convention>(
    parsed.data.convenios.map((convention) => [
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

  for (const convention of conventions.values()) {
    for (const code of convention.coveredProcedureCodes) {
      if (!procedures.has(code)) {
        throw new Error(
          `Convênio "${convention.name}" cobre o procedimento ${code}, que não existe na tabela de procedimentos.`,
        );
      }
    }
  }

  return {
    version: parsed.data.versao,
    hash: hashOf(contents),
    procedures,
    conventions,
  };
}

const cache = new Map<string, Promise<RuleSet>>();

/**
 * Loads the rule set from disk once per file path. The rules are the source of
 * truth and never change at runtime, so re-reading them per request would only
 * add latency and a chance of two requests disagreeing.
 */
export function loadRuleSet(filePath: string = DEFAULT_RULE_FILE): Promise<RuleSet> {
  const cached = cache.get(filePath);
  if (cached !== undefined) return cached;

  const loading = readFile(filePath, "utf8").then(toRuleSet);
  cache.set(filePath, loading);
  return loading;
}

/** Test seam: builds a rule set from an in-memory file body. */
export function ruleSetFromJson(contents: string): RuleSet {
  return toRuleSet(contents);
}
