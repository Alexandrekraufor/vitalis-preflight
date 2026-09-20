import type { Finding } from "../finding";
import type { Validator } from "../rules.types";

/**
 * Two independent ceilings apply to a session number: the limit printed on the
 * authorization itself, and the maximum the convention allows per
 * authorization. Either can be the one that is violated.
 */
export const validateSessionLimits: Validator = ({ guide, convention }) => {
  const findings: Finding[] = [];
  const { sessionNumber, authorizationSessionLimit } = guide;

  if (convention !== null && authorizationSessionLimit !== null) {
    const conventionMax = convention.maxSessionsPerAuthorization;
    if (authorizationSessionLimit > conventionMax) {
      findings.push({
        code: "AUTHORIZATION_LIMIT_ABOVE_CONVENTION_MAX",
        severity: "REVIEW",
        field: "autorizacao_sessoes_limite",
        message: `A autorização registra ${authorizationSessionLimit} sessões, acima do máximo de ${conventionMax} previsto para ${convention.name}.`,
        expected: `No máximo ${conventionMax} sessões`,
        actual: String(authorizationSessionLimit),
        source: "CONVENTION_RULE",
        evidence: null,
        recommendedAction:
          "Conferir com o convênio qual limite vale para esta autorização.",
      });
    }
  }

  if (sessionNumber === null) {
    if (authorizationSessionLimit !== null) {
      findings.push({
        code: "SESSION_NUMBER_MISSING",
        severity: "BLOCKING",
        field: "sessao_numero_na_autorizacao",
        message:
          "A autorização define um limite de sessões, mas a posição desta sessão não foi informada.",
        expected: "Número da sessão dentro da autorização",
        actual: null,
        source: "CONVENTION_RULE",
        evidence: null,
        recommendedAction: "Informar qual sessão da autorização é esta.",
      });
    }
    return findings;
  }

  if (authorizationSessionLimit !== null && sessionNumber > authorizationSessionLimit) {
    findings.push({
      code: "AUTHORIZATION_SESSION_LIMIT_EXCEEDED",
      severity: "BLOCKING",
      field: "sessao_numero_na_autorizacao",
      message: `Esta é a sessão ${sessionNumber}, mas a autorização cobre apenas ${authorizationSessionLimit} sessões.`,
      expected: `Sessão até ${authorizationSessionLimit}`,
      actual: String(sessionNumber),
      source: "CONVENTION_RULE",
      evidence: null,
      recommendedAction:
        "Emitir nova autorização para as sessões excedentes antes do envio.",
    });
  }

  if (convention !== null && sessionNumber > convention.maxSessionsPerAuthorization) {
    findings.push({
      code: "CONVENTION_SESSION_LIMIT_EXCEEDED",
      severity: "BLOCKING",
      field: "sessao_numero_na_autorizacao",
      message: `${convention.name} permite no máximo ${convention.maxSessionsPerAuthorization} sessões por autorização, e esta é a sessão ${sessionNumber}.`,
      expected: `Sessão até ${convention.maxSessionsPerAuthorization}`,
      actual: String(sessionNumber),
      source: "CONVENTION_RULE",
      evidence: null,
      recommendedAction:
        "Abrir nova autorização junto ao convênio para continuar o tratamento.",
    });
  }

  return findings;
};
