import { formatBrl } from "@/lib/money";

import type { Finding } from "../finding";
import type { Validator } from "../rules.types";

/**
 * Money is compared, never corrected. A guide billed at the wrong amount is a
 * finding for a human; rewriting it would hide a revenue problem.
 */
export const validateReferenceValue: Validator = ({ guide, procedure }) => {
  if (procedure === null) return [];

  if (guide.amount === null) {
    const missing: Finding = {
      code: "AMOUNT_MISSING",
      severity: "BLOCKING",
      field: "valor",
      message: "A guia não informa valor.",
      expected: formatBrl(procedure.referenceValue),
      actual: null,
      source: "REFERENCE_TABLE",
      evidence: null,
      recommendedAction: "Lançar o valor do procedimento antes do envio.",
    };
    return [missing];
  }

  if (guide.amount === procedure.referenceValue) return [];

  const mismatch: Finding = {
    code: "AMOUNT_DIFFERS_FROM_REFERENCE",
    severity: "BLOCKING",
    field: "valor",
    message: `O valor lançado (${formatBrl(guide.amount)}) difere da tabela de referência (${formatBrl(procedure.referenceValue)}).`,
    expected: formatBrl(procedure.referenceValue),
    actual: formatBrl(guide.amount),
    source: "REFERENCE_TABLE",
    evidence: null,
    recommendedAction: "Ajustar o valor para a tabela vigente ou justificar a diferença.",
  };

  return [mismatch];
};
