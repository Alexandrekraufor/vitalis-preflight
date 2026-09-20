import type { Finding } from "../finding";
import type { Validator } from "../rules.types";

function comparable(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * The code is authoritative; the description is what a human will read on the
 * guide. When they disagree, one of the two is wrong and only a person knows
 * which — so this never rewrites the description.
 */
export const validateProcedureDescription: Validator = ({ guide, procedure }) => {
  if (procedure === null) return [];

  const description = guide.procedureDescription;
  if (description === null) return [];
  if (comparable(description) === comparable(procedure.description)) return [];

  const finding: Finding = {
    code: "PROCEDURE_DESCRIPTION_MISMATCH",
    severity: "REVIEW",
    field: "procedimento_descricao",
    message: `A descrição lançada não corresponde ao código ${procedure.code}.`,
    expected: procedure.description,
    actual: description,
    source: "REFERENCE_TABLE",
    evidence: null,
    recommendedAction:
      "Confirmar qual procedimento foi realizado e corrigir código ou descrição.",
  };

  return [finding];
};
