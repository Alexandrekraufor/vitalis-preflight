import { coversProcedure } from "@/domain/conventions/convention";

import type { Finding } from "../finding";
import type { Validator } from "../rules.types";

/**
 * A procedure has to exist in the reference table and be covered by the
 * convention on the guide. Neither gap is something the system can fix on its
 * own: the correct code is clinical information.
 */
export const validateProcedureCoverage: Validator = ({ guide, convention, procedure }) => {
  if (procedure === null) {
    const finding: Finding = {
      code: "UNKNOWN_PROCEDURE",
      severity: "REVIEW",
      field: "procedimento_codigo",
      message: `O código ${guide.procedureCode} não está na tabela de procedimentos das regras vigentes.`,
      expected: "Código presente na tabela de referência",
      actual: guide.procedureCode,
      source: "REFERENCE_TABLE",
      evidence: null,
      recommendedAction:
        "Conferir o código lançado; se o procedimento for novo, atualizar a tabela de regras.",
    };
    return [finding];
  }

  if (convention === null) return [];
  if (coversProcedure(convention, procedure.code)) return [];

  const finding: Finding = {
    code: "PROCEDURE_NOT_COVERED",
    severity: "BLOCKING",
    field: "procedimento_codigo",
    message: `${convention.name} não cobre ${procedure.description} (${procedure.code}). ${convention.note}`,
    expected: `Um dos códigos cobertos: ${convention.coveredProcedureCodes.join(", ")}`,
    actual: procedure.code,
    source: "CONVENTION_RULE",
    evidence: null,
    recommendedAction:
      "Não enviar este procedimento a este convênio; verificar faturamento alternativo.",
  };

  return [finding];
};
