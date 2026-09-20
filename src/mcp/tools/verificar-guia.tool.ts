import { z } from "zod";

import { getGuide } from "@/application/guides/get-guide.use-case";
import { toValidationReport } from "@/application/guides/validation-report";
import { validateGuide } from "@/application/guides/validate-guide.use-case";
import { toGuideDetailReport } from "@/application/guides/guide-detail-report";
import type { AppServices } from "@/infrastructure/composition-root";

import type { McpToolDefinition } from "../tool.types";

/** Any column may be absent - an absent required field is a finding, not an error. */
const field = z.union([z.string(), z.number()]).nullish();

const guideSchema = z.object({
  id_guia: field,
  unidade: field,
  data_atendimento: field,
  paciente: field,
  convenio: field,
  carteirinha: field,
  cid: field,
  procedimento_codigo: field,
  procedimento_descricao: field,
  numero_autorizacao: field,
  autorizacao_validade: field,
  autorizacao_sessoes_limite: field,
  sessao_numero_na_autorizacao: field,
  profissional: field,
  profissional_registro: field,
  valor: field,
  observacao_recepcao: field,
  data_lancamento: field,
});

const inputShape = {
  guia: guideSchema.optional().describe(
      "Guia completa, usando os nomes de coluna do sistema da clínica (id_guia, unidade, data_atendimento, convenio, procedimento_codigo, numero_autorizacao, autorizacao_validade, valor, observacao_recepcao, ...). Datas podem vir em AAAA-MM-DD ou DD/MM/AAAA e valores com ponto ou vírgula.",
    ),
  id_guia: z
    .string()
    .min(1)
    .optional()
    .describe("Id de uma guia já existente no Vitalis Preflight, quando não houver os dados completos."),
};

const outputShape = {
  idGuia: z.string().nullable(),
  status: z
    .string()
    .describe("READY_TO_SUBMIT, NEEDS_CORRECTION ou REVIEW_REQUIRED."),
  statusLabel: z.string(),
  podeEnviar: z.boolean(),
  motivo: z.string().describe("Resumo em uma frase de por que a guia recebeu esse status."),
  porQueCaiu: z.array(z.string()).describe("Explicação derivada dos findings, sem interpretação nova."),
  findings: z.array(
    z.object({
      code: z.string(),
      severity: z.string(),
      field: z.string().nullable(),
      message: z.string(),
      expected: z.string().nullable(),
      actual: z.string().nullable(),
      evidence: z.string().nullable(),
    }),
  ),
  acoesRecomendadas: z.array(z.string()),
  normalizacoes: z.array(
    z.object({ field: z.string(), from: z.string(), to: z.string().nullable(), reason: z.string() }),
  ),
  versaoDasRegras: z.string(),
  erro: z.string().nullable().describe("Preenchido quando a guia não pôde sequer ser interpretada."),
};

type Output = { [K in keyof typeof outputShape]: z.infer<(typeof outputShape)[K]> };

/**
 * Runs the same preflight the web application and the REST API run, over a
 * guide supplied inline or one already stored. Nothing is modified.
 */
export function verificarGuiaTool(
  services: AppServices,
): McpToolDefinition<typeof inputShape, typeof outputShape> {
  return {
    name: "verificar_guia",
    config: {
      title: "Verificar guia",
      description:
        "Verifica se uma guia está pronta para envio ao convênio aplicando as regras vigentes da Clínica Vitalis. Retorna a decisão (pronta, precisa corrigir ou precisa de revisão humana), o motivo, os problemas encontrados com campo e evidência, as ações recomendadas e as normalizações de formato aplicadas. Passe `guia` com os campos que você tem, ou `id_guia` para reavaliar uma guia já registrada. É uma operação somente de validação: não altera, corrige, aprova, envia nem exclui a guia, e nenhuma guia é criada por consultá-la.",
      inputSchema: inputShape,
      outputSchema: outputShape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async handler({ guia, id_guia }): Promise<Output> {
      if (guia === undefined && id_guia === undefined) {
        return failure(null, "Informe `guia` com os dados da guia ou `id_guia`.", services);
      }

      if (guia === undefined) {
        const detail = await getGuide(id_guia ?? "", services.guides);

        if (detail === null) {
          return failure(
            id_guia ?? null,
            `Guia ${id_guia} não encontrada no Vitalis Preflight.`,
            services,
          );
        }

        const report = toGuideDetailReport(detail);
        return {
          idGuia: detail.guide.idGuia,
          status: report.status,
          statusLabel: report.statusLabel,
          podeEnviar: report.canSubmit,
          motivo: report.summary,
          porQueCaiu: report.whyItFell,
          findings: report.findings,
          acoesRecomendadas: report.recommendedActions,
          normalizacoes: report.normalizations,
          versaoDasRegras: report.rules.version,
          erro: null,
        };
      }

      const validated = await validateGuide(guia, services);

      if (!validated.ok) {
        return failure(
          typeof guia.id_guia === "string" ? guia.id_guia : null,
          `A guia não pôde ser interpretada: ${validated.error
            .map((issue) => `${issue.field} - ${issue.message}`)
            .join("; ")}`,
          services,
        );
      }

      const report = toValidationReport(
        validated.value.result,
        validated.value.normalizations,
      );

      return {
        idGuia: report.idGuia,
        status: report.status,
        statusLabel: report.statusLabel,
        podeEnviar: report.canSubmit,
        motivo: report.summary,
        porQueCaiu: report.whyItFell,
        findings: report.findings,
        acoesRecomendadas: report.recommendedActions,
        normalizacoes: report.normalizations,
        versaoDasRegras: report.rules.version,
        erro: null,
      };
    },
  };
}

/** Errors are data, not exceptions: an agent has to be able to read what went wrong. */
function failure(idGuia: string | null, message: string, services: AppServices): Output {
  return {
    idGuia,
    status: "REVIEW_REQUIRED",
    statusLabel: "Revisão humana",
    podeEnviar: false,
    motivo: message,
    porQueCaiu: [message],
    findings: [],
    acoesRecomendadas: [],
    normalizacoes: [],
    versaoDasRegras: services.ruleSet.version,
    erro: message,
  };
}
