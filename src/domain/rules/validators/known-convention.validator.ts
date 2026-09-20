import type { Finding } from "../finding";
import type { Validator } from "../rules.types";

/**
 * A convention that is not in the rule set cannot be validated at all. That is
 * a human problem (a new contract, a typo in the export), not a correction the
 * reception can make blindly.
 */
export const validateKnownConvention: Validator = ({ guide, convention, ruleSet }) => {
  if (convention !== null) return [];

  const known = [...ruleSet.conventions.values()].map((item) => item.name).join(", ");

  const finding: Finding = {
    code: "UNKNOWN_CONVENTION",
    severity: "REVIEW",
    field: "convenio",
    message: `O convênio "${guide.conventionName}" não existe na versão ${ruleSet.version} das regras. Nenhuma regra de convênio pôde ser aplicada.`,
    expected: known,
    actual: guide.conventionName,
    source: "CONVENTION_RULE",
    evidence: null,
    recommendedAction:
      "Conferir o convênio lançado ou cadastrar as regras desse convênio antes do envio.",
  };

  return [finding];
};
