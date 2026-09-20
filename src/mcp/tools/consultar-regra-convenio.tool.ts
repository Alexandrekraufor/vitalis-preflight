import { z } from "zod";

import { coversProcedure, findConvention, findProcedure } from "@/domain/conventions/convention";
import type { RuleSet } from "@/domain/conventions/convention.types";
import { toDecimalString } from "@/lib/money";

import type { McpToolDefinition } from "../tool.types";

const inputShape = {
  convenio: z
    .string()
    .min(1)
    .describe('Nome do convênio como aparece na guia. Ex.: "Vitalcard", "Saúde Interior", "Plano Bem".'),
  procedimento_codigo: z
    .string()
    .min(1)
    .describe('Código do procedimento (TUSS) exatamente como lançado. Ex.: "50000470".'),
};

const outputShape = {
  convenio: z.string().nullable().describe("Nome oficial do convênio nas regras vigentes."),
  convenioConhecido: z.boolean(),
  procedimento: z
    .object({ codigo: z.string(), descricao: z.string(), valorReferencia: z.number() })
    .nullable(),
  procedimentoConhecido: z.boolean(),
  coberto: z.boolean().nullable().describe("null quando convênio ou procedimento é desconhecido."),
  camposObrigatorios: z.array(z.string()),
  limiteSessoesPorAutorizacao: z.number().nullable(),
  validadeMaximaAutorizacaoDias: z.number().nullable(),
  prazoEnvioDias: z.number().nullable(),
  observacaoDaRegra: z.string().nullable(),
  versaoDasRegras: z.string(),
  hashDasRegras: z.string(),
};

/**
 * Read-only lookup of the rule book. Agents call this before reasoning about a
 * guide so they quote the real rule instead of recalling one.
 */
export function consultarRegraConvenioTool(ruleSet: RuleSet): McpToolDefinition<
  typeof inputShape,
  typeof outputShape
> {
  return {
    name: "consultar_regra_convenio",
    config: {
      title: "Consultar regra do convênio",
      description:
        "Retorna as regras vigentes de um convênio para um procedimento: se é coberto, o valor de referência, os campos obrigatórios, o limite de sessões por autorização, o prazo de envio e a observação oficial da regra. Use SEMPRE que precisar saber o que um convênio exige ou cobre — nunca deduza uma regra de memória. Também informa quando o convênio ou o procedimento não existe na versão atual das regras. É uma operação somente de leitura: não altera regras nem guias.",
      inputSchema: inputShape,
      outputSchema: outputShape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    handler: ({ convenio, procedimento_codigo }) => {
      const convention = findConvention(ruleSet, convenio);
      const procedure = findProcedure(ruleSet, procedimento_codigo);

      return Promise.resolve({
        convenio: convention?.name ?? null,
        convenioConhecido: convention !== null,
        procedimento:
          procedure === null
            ? null
            : {
                codigo: procedure.code,
                descricao: procedure.description,
                valorReferencia: Number(toDecimalString(procedure.referenceValue)),
              },
        procedimentoConhecido: procedure !== null,
        coberto:
          convention === null || procedure === null
            ? null
            : coversProcedure(convention, procedure.code),
        camposObrigatorios: convention === null ? [] : [...convention.requiredFields],
        limiteSessoesPorAutorizacao: convention?.maxSessionsPerAuthorization ?? null,
        validadeMaximaAutorizacaoDias: convention?.maxAuthorizationValidityDays ?? null,
        prazoEnvioDias: convention?.submissionDeadlineDays ?? null,
        observacaoDaRegra: convention?.note ?? null,
        versaoDasRegras: ruleSet.version,
        hashDasRegras: ruleSet.hash,
      });
    },
  };
}
