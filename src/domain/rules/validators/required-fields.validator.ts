import { REQUIRED_FIELD_CODES } from "../finding-codes";
import type { Finding } from "../finding";
import type { RuleContext, Validator } from "../rules.types";
import type { RequiredFieldName } from "@/domain/conventions/convention.types";

const FIELD_LABELS: Readonly<Record<RequiredFieldName, string>> = {
  numero_autorizacao: "número da autorização",
  autorizacao_validade: "validade da autorização",
  profissional_registro: "registro do profissional",
  carteirinha: "carteirinha",
  cid: "CID",
};

function valueOf(field: RequiredFieldName, { guide }: RuleContext): string | null {
  switch (field) {
    case "numero_autorizacao":
      return guide.authorizationNumber;
    case "autorizacao_validade":
      return guide.authorizationValidThrough;
    case "profissional_registro":
      return guide.professionalRegistration;
    case "carteirinha":
      return guide.membershipNumber;
    case "cid":
      return guide.cid;
  }
}

/** Each convention publishes its own list of fields; nothing is assumed. */
export const validateRequiredFields: Validator = (context) => {
  const { convention } = context;
  if (convention === null) return [];

  const findings: Finding[] = [];

  for (const field of convention.requiredFields) {
    if (valueOf(field, context) !== null) continue;

    findings.push({
      code: REQUIRED_FIELD_CODES[field],
      severity: "BLOCKING",
      field,
      message: `${convention.name} exige ${FIELD_LABELS[field]}, e o campo está vazio.`,
      expected: "Campo preenchido",
      actual: null,
      source: "CONVENTION_RULE",
      evidence: null,
      recommendedAction: `Preencher ${FIELD_LABELS[field]} antes do envio.`,
    });
  }

  return findings;
};
