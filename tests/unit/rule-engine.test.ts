import { describe, expect, it } from "vitest";

import { parseGuide } from "@/domain/guides/guide";
import type { IsoDate } from "@/lib/dates";
import { toIsoDate } from "@/lib/dates";
import { runRuleEngine } from "@/domain/rules/rule-engine";
import { aGuideRecord } from "@tests/fixtures/guide-record";
import { testRuleSet } from "@tests/fixtures/rule-set";
import { codesOf, validateRecord } from "@tests/fixtures/validate";

function isoDate(value: string): IsoDate {
  const parsed = toIsoDate(value);
  if (parsed === null) throw new Error(`Data de teste inválida: ${value}`);
  return parsed;
}

describe("baseline", () => {
  it("clears a guide that satisfies every rule", async () => {
    const result = await validateRecord(aGuideRecord());

    expect(result.findings).toEqual([]);
    expect(result.decision.status).toBe("READY_TO_SUBMIT");
    expect(result.decision.canSubmit).toBe(true);
    expect(result.decision.amountAtRisk).toBe(0);
  });

  it("stamps the rule set version and hash on the result", async () => {
    const result = await validateRecord(aGuideRecord());

    expect(result.rules.version).toBe("agosto/2026");
    expect(result.rules.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("authorization expiration", () => {
  it("accepts an appointment on the last valid day", async () => {
    const result = await validateRecord(
      aGuideRecord({ data_atendimento: "2026-08-31", autorizacao_validade: "2026-08-31" }),
    );

    expect(codesOf(result)).not.toContain("AUTHORIZATION_EXPIRED");
    expect(result.decision.status).toBe("READY_TO_SUBMIT");
  });

  it("blocks an appointment one day after the authorization expired", async () => {
    const result = await validateRecord(
      aGuideRecord({ data_atendimento: "2026-09-01", autorizacao_validade: "2026-08-31" }),
    );

    expect(codesOf(result)).toContain("AUTHORIZATION_EXPIRED");
    expect(result.decision.status).toBe("NEEDS_CORRECTION");
    expect(result.decision.amountAtRisk).toBe(6200);
  });
});

describe("required fields", () => {
  it("requires CID for Vitalcard", async () => {
    const result = await validateRecord(aGuideRecord({ cid: "" }));

    expect(codesOf(result)).toContain("CID_MISSING");
    expect(result.decision.status).toBe("NEEDS_CORRECTION");
  });

  it("does not require CID for Saude Interior", async () => {
    const result = await validateRecord(
      aGuideRecord({
        convenio: "Saúde Interior",
        cid: "",
        autorizacao_sessoes_limite: "20",
      }),
    );

    expect(codesOf(result)).not.toContain("CID_MISSING");
    expect(result.decision.status).toBe("READY_TO_SUBMIT");
  });

  it("reports a missing authorization number with its own code", async () => {
    const result = await validateRecord(aGuideRecord({ numero_autorizacao: "" }));

    expect(codesOf(result)).toContain("AUTHORIZATION_NUMBER_MISSING");
  });

  it("reports a missing professional registration", async () => {
    const result = await validateRecord(aGuideRecord({ profissional_registro: "" }));

    expect(codesOf(result)).toContain("PROFESSIONAL_REGISTRATION_MISSING");
  });
});

describe("session limits", () => {
  it("accepts the last session covered by the authorization", async () => {
    const result = await validateRecord(
      aGuideRecord({ sessao_numero_na_autorizacao: "10", autorizacao_sessoes_limite: "10" }),
    );

    expect(result.decision.status).toBe("READY_TO_SUBMIT");
  });

  it("blocks a session beyond the authorization limit", async () => {
    const result = await validateRecord(
      aGuideRecord({ sessao_numero_na_autorizacao: "11", autorizacao_sessoes_limite: "10" }),
    );

    expect(codesOf(result)).toContain("AUTHORIZATION_SESSION_LIMIT_EXCEEDED");
    expect(result.decision.status).toBe("NEEDS_CORRECTION");
  });

  it("blocks a session beyond the convention maximum even if the authorization allows it", async () => {
    const result = await validateRecord(
      aGuideRecord({ sessao_numero_na_autorizacao: "12", autorizacao_sessoes_limite: "15" }),
    );

    expect(codesOf(result)).toContain("CONVENTION_SESSION_LIMIT_EXCEEDED");
    expect(codesOf(result)).toContain("AUTHORIZATION_LIMIT_ABOVE_CONVENTION_MAX");
  });
});

describe("procedures", () => {
  it("accepts a covered procedure", async () => {
    const result = await validateRecord(aGuideRecord());

    expect(codesOf(result)).not.toContain("PROCEDURE_NOT_COVERED");
  });

  it("blocks a procedure the convention does not cover", async () => {
    const result = await validateRecord(
      aGuideRecord({
        convenio: "Plano Bem",
        autorizacao_sessoes_limite: "12",
        procedimento_codigo: "20103301",
        procedimento_descricao: "Consulta ortopédica",
        valor: "90.00",
      }),
    );

    expect(codesOf(result)).toContain("PROCEDURE_NOT_COVERED");
    expect(result.decision.status).toBe("NEEDS_CORRECTION");
  });

  it("flags an unknown procedure code for review instead of guessing", async () => {
    const result = await validateRecord(aGuideRecord({ procedimento_codigo: "99999999" }));

    expect(codesOf(result)).toContain("UNKNOWN_PROCEDURE");
    expect(result.decision.status).toBe("REVIEW_REQUIRED");
  });

  it("flags a description that disagrees with the code", async () => {
    const result = await validateRecord(
      aGuideRecord({ procedimento_descricao: "Drenagem linfática" }),
    );

    expect(codesOf(result)).toContain("PROCEDURE_DESCRIPTION_MISMATCH");
    expect(result.decision.status).toBe("REVIEW_REQUIRED");
  });

  it("ignores accent and case differences in the description", async () => {
    const result = await validateRecord(
      aGuideRecord({ procedimento_descricao: "SESSAO DE FISIOTERAPIA MUSCULOESQUELETICA" }),
    );

    expect(codesOf(result)).not.toContain("PROCEDURE_DESCRIPTION_MISMATCH");
  });
});

describe("conventions", () => {
  it("matches a convention regardless of accents and case", async () => {
    const result = await validateRecord(
      aGuideRecord({ convenio: "SAUDE INTERIOR", cid: "", autorizacao_sessoes_limite: "20" }),
    );

    expect(codesOf(result)).not.toContain("UNKNOWN_CONVENTION");
  });

  it("stops at review when the convention is unknown", async () => {
    const result = await validateRecord(aGuideRecord({ convenio: "Convênio Novo" }));

    expect(codesOf(result)).toEqual(["UNKNOWN_CONVENTION"]);
    expect(result.decision.status).toBe("REVIEW_REQUIRED");
  });
});

describe("reference value", () => {
  it("accepts the reference amount written with a comma", async () => {
    const result = await validateRecord(aGuideRecord({ valor: "62,00" }));

    expect(codesOf(result)).not.toContain("AMOUNT_DIFFERS_FROM_REFERENCE");
  });

  it("reports a divergent amount without changing it", async () => {
    const result = await validateRecord(aGuideRecord({ valor: "72.00" }));

    const finding = result.findings.find(
      (candidate) => candidate.code === "AMOUNT_DIFFERS_FROM_REFERENCE",
    );

    expect(finding).toMatchObject({ expected: "R$ 62,00", actual: "R$ 72,00" });
    expect(result.guide.amount).toBe(7200);
  });
});

describe("rules that depend on data the export does not carry", () => {
  it("stays silent about the authorization window when no issue date is known", async () => {
    const result = await validateRecord(aGuideRecord({ autorizacao_validade: "2026-12-31" }));

    expect(codesOf(result)).not.toContain("AUTHORIZATION_WINDOW_EXCEEDED");
  });

  it("checks the authorization window once the issue date is supplied", () => {
    const parsed = parseGuide(aGuideRecord({ autorizacao_validade: "2026-12-31" }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = runRuleEngine({
      guide: parsed.value.guide,
      ruleSet: testRuleSet,
      observation: null,
      supplementary: {
        authorizationIssuedAt: isoDate("2026-08-01"),
        submittedToConventionAt: null,
      },
    });

    expect(result.findings.map((finding) => finding.code)).toContain(
      "AUTHORIZATION_WINDOW_EXCEEDED",
    );
  });

  it("checks the submission deadline once a real submission date is supplied", () => {
    const parsed = parseGuide(aGuideRecord());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const result = runRuleEngine({
      guide: parsed.value.guide,
      ruleSet: testRuleSet,
      observation: null,
      supplementary: {
        authorizationIssuedAt: null,
        submittedToConventionAt: isoDate("2026-10-30"),
      },
    });

    expect(result.findings.map((finding) => finding.code)).toContain(
      "SUBMISSION_DEADLINE_EXCEEDED",
    );
  });
});
