import { z } from "zod";

import { getGuide } from "@/application/guides/get-guide.use-case";
import { toGuideDetailReport } from "@/application/guides/guide-detail-report";
import type { AppServices } from "@/infrastructure/composition-root";

import type { McpToolDefinition } from "../tool.types";

const inputShape = {
  id_guia: z.string().min(1).describe('Identificador da guia. Ex.: "G-2608-0041".'),
};

const outputShape = {
  encontrada: z.boolean(),
  guia: z.record(z.string(), z.string().nullable()).nullable(),
  status: z.string().nullable(),
  statusLabel: z.string().nullable(),
  podeEnviar: z.boolean().nullable(),
  motivo: z.string().nullable(),
  porQueCaiu: z.array(z.string()),
  findings: z.array(
    z.object({
      code: z.string(),
      severity: z.string(),
      field: z.string().nullable(),
      message: z.string(),
      evidence: z.string().nullable(),
    }),
  ),
  acoesRecomendadas: z.array(z.string()),
  validadaEm: z.string().nullable(),
  versaoDasRegras: z.string().nullable(),
  historico: z.array(
    z.object({ status: z.string(), versao: z.number(), completadaEm: z.string() }),
  ),
};

/**
 * Reads a guide already in the system, exactly as it was decided — no
 * re-evaluation, so the answer matches what the clinic sees on screen.
 */
export function consultarGuiaTool(
  services: AppServices,
): McpToolDefinition<typeof inputShape, typeof outputShape> {
  return {
    name: "consultar_guia",
    config: {
      title: "Consultar guia registrada",
      description:
        "Retorna uma guia já registrada no Vitalis Preflight com os dados normalizados, a decisão gravada, os problemas encontrados, as ações recomendadas e o histórico de validações. Use quando a pessoa citar um id de guia e quiser saber a situação atual dela. Diferente de verificar_guia, esta tool não reexecuta as regras: mostra a decisão registrada. É uma operação somente de leitura: não altera, corrige, aprova nem exclui a guia.",
      inputSchema: inputShape,
      outputSchema: outputShape,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async handler({ id_guia }) {
      const detail = await getGuide(id_guia, services.guides);

      if (detail === null) {
        return {
          encontrada: false,
          guia: null,
          status: null,
          statusLabel: null,
          podeEnviar: null,
          motivo: null,
          porQueCaiu: [],
          findings: [],
          acoesRecomendadas: [],
          validadaEm: null,
          versaoDasRegras: null,
          historico: [],
        };
      }

      const report = toGuideDetailReport(detail);

      return {
        encontrada: true,
        guia: report.guide,
        status: report.status,
        statusLabel: report.statusLabel,
        podeEnviar: report.canSubmit,
        motivo: report.summary,
        porQueCaiu: report.whyItFell,
        findings: report.findings.map((finding) => ({
          code: finding.code,
          severity: finding.severity,
          field: finding.field,
          message: finding.message,
          evidence: finding.evidence,
        })),
        acoesRecomendadas: report.recommendedActions,
        validadaEm: report.validatedAt,
        versaoDasRegras: report.rules.version,
        historico: report.history.map((run) => ({
          status: run.status,
          versao: run.versionNumber,
          completadaEm: run.completedAt,
        })),
      };
    },
  };
}
