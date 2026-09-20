import { z } from "zod";

import { getOperationalSummary } from "@/application/reports/get-operational-summary.use-case";
import type { GuideListFilter } from "@/application/ports/guide-repository.port";
import { GUIDE_STATUSES } from "@/domain/guides/guide-status";
import { CLINIC_UNITS } from "@/domain/guides/guide.types";
import type { AppServices } from "@/infrastructure/composition-root";
import { toDecimalString } from "@/lib/money";

import type { McpToolDefinition } from "../tool.types";

const inputShape = {
  unidade: z.enum(CLINIC_UNITS).optional().describe("Filtra por unidade da clínica."),
  convenio: z.string().min(1).optional().describe("Filtra por convênio."),
  status: z
    .enum(GUIDE_STATUSES)
    .optional()
    .describe("Filtra por decisão: READY_TO_SUBMIT, NEEDS_CORRECTION ou REVIEW_REQUIRED."),
};

const outputShape = {
  verificadas: z.number(),
  prontasParaEnvio: z.number(),
  precisamCorrecao: z.number(),
  precisamRevisao: z.number(),
  valorEmRisco: z.number().describe("Soma, em reais, das guias que não podem ser enviadas."),
  valorProtegido: z.number().describe("Soma, em reais, das guias liberadas para envio."),
  principaisProblemas: z.array(
    z.object({ code: z.string(), descricao: z.string(), guias: z.number(), valorEmRisco: z.number() }),
  ),
  porUnidade: z.array(
    z.object({
      unidade: z.string(),
      verificadas: z.number(),
      prontasParaEnvio: z.number(),
      precisamCorrecao: z.number(),
      precisamRevisao: z.number(),
      valorEmRisco: z.number(),
    }),
  ),
  filaDeTrabalho: z.array(
    z.object({
      idGuia: z.string(),
      unidade: z.string(),
      convenio: z.string(),
      status: z.string(),
      valorEmRisco: z.number(),
      problemaPrincipal: z.string().nullable(),
    }),
  ),
};

/**
 * The operations picture in one call: how many guides were checked, how many
 * are blocked, what it is worth and which ones to open first.
 */
export function resumoOperacionalTool(
  services: AppServices,
): McpToolDefinition<typeof inputShape, typeof outputShape> {
  return {
    name: "resumo_operacional",
    config: {
      title: "Resumo operacional",
      description:
        "Resume a situação das guias validadas: quantas foram verificadas, quantas estão prontas para envio, quantas precisam de correção, quantas precisam de revisão humana, o valor em risco e o valor protegido, os problemas mais frequentes, a comparação entre as unidades e uma fila das guias mais caras que estão travadas. Aceita filtros por unidade, convênio e status. Use para perguntas do tipo 'como estamos', 'quanto está em risco' ou 'o que atacar primeiro'. É uma operação somente de leitura: não altera nenhuma guia.",
      inputSchema: inputShape,
      outputSchema: outputShape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async handler({ unidade, convenio, status }) {
      const filter: GuideListFilter = {
        ...(unidade === undefined ? {} : { unit: unidade }),
        ...(convenio === undefined ? {} : { conventionName: convenio }),
        ...(status === undefined ? {} : { status }),
      };

      const { summary, actionQueue } = await getOperationalSummary(filter, services);

      return {
        verificadas: summary.total,
        prontasParaEnvio: summary.readyToSubmit,
        precisamCorrecao: summary.needsCorrection,
        precisamRevisao: summary.reviewRequired,
        valorEmRisco: Number(toDecimalString(summary.amountAtRisk)),
        valorProtegido: Number(toDecimalString(summary.amountProtected)),
        principaisProblemas: summary.topProblems.map((item) => ({
          code: item.code,
          descricao: item.label,
          guias: item.guides,
          valorEmRisco: Number(toDecimalString(item.amountAtRisk)),
        })),
        porUnidade: summary.byUnit.map((unit) => ({
          unidade: unit.unit,
          verificadas: unit.total,
          prontasParaEnvio: unit.readyToSubmit,
          precisamCorrecao: unit.needsCorrection,
          precisamRevisao: unit.reviewRequired,
          valorEmRisco: Number(toDecimalString(unit.amountAtRisk)),
        })),
        filaDeTrabalho: actionQueue.map((item) => ({
          idGuia: item.idGuia,
          unidade: item.unit,
          convenio: item.conventionName,
          status: item.status,
          valorEmRisco: Number(toDecimalString(item.amountAtRisk)),
          problemaPrincipal: item.primaryFindingMessage,
        })),
      };
    },
  };
}
