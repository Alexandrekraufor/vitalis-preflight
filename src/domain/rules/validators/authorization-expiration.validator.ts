import { formatBrazilianDate, isBefore } from "@/lib/dates";

import type { Finding } from "../finding";
import type { Validator } from "../rules.types";

/**
 * The authorization covers its final day. `validade == atendimento` is valid;
 * only an appointment *after* the final day is a problem.
 */
export const validateAuthorizationExpiration: Validator = ({ guide }) => {
  const validThrough = guide.authorizationValidThrough;
  if (validThrough === null) return [];

  if (!isBefore(validThrough, guide.appointmentDate)) return [];

  const finding: Finding = {
    code: "AUTHORIZATION_EXPIRED",
    severity: "BLOCKING",
    field: "autorizacao_validade",
    message: `A autorização venceu em ${formatBrazilianDate(validThrough)}, mas o atendimento ocorreu em ${formatBrazilianDate(guide.appointmentDate)}.`,
    expected: `Validade em ${formatBrazilianDate(guide.appointmentDate)} ou depois`,
    actual: formatBrazilianDate(validThrough),
    source: "CONVENTION_RULE",
    evidence: null,
    recommendedAction:
      "Registrar a autorização vigente na data do atendimento antes do envio.",
  };

  return [finding];
};
