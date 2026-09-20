import { daysBetween, formatBrazilianDate } from "@/lib/dates";

import type { Finding } from "../finding";
import type { Validator } from "../rules.types";

/**
 * `validade_maxima_autorizacao_dias` limits how long an authorization may live,
 * counted from the day the convention issued it. The clinic's export does not
 * carry that issue date, so this rule stays silent until the data is supplied
 * through `SupplementaryGuideData` (see `docs/assumptions.md`).
 */
export const validateAuthorizationValidityWindow: Validator = ({
  guide,
  convention,
  supplementary,
}) => {
  const issuedAt = supplementary.authorizationIssuedAt;
  const validThrough = guide.authorizationValidThrough;

  if (convention === null || issuedAt === null || validThrough === null) return [];

  const windowDays = daysBetween(issuedAt, validThrough);
  if (windowDays <= convention.maxAuthorizationValidityDays) return [];

  const finding: Finding = {
    code: "AUTHORIZATION_WINDOW_EXCEEDED",
    severity: "REVIEW",
    field: "autorizacao_validade",
    message: `A autorização foi emitida em ${formatBrazilianDate(issuedAt)} e vale até ${formatBrazilianDate(validThrough)} (${windowDays} dias), acima dos ${convention.maxAuthorizationValidityDays} dias permitidos por ${convention.name}.`,
    expected: `No máximo ${convention.maxAuthorizationValidityDays} dias de validade`,
    actual: `${windowDays} dias`,
    source: "CONVENTION_RULE",
    evidence: null,
    recommendedAction: "Confirmar a validade real da autorização com o convênio.",
  };

  return [finding];
};
