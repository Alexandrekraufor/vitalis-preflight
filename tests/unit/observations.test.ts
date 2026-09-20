import { describe, expect, it } from "vitest";

import type { TextCompletionClient } from "@/infrastructure/llm/text-completion.port";
import { heuristicObservationInterpreter } from "@/infrastructure/observations/heuristic-observation-interpreter";
import { createLlmObservationInterpreter } from "@/infrastructure/observations/llm-observation-interpreter";
import { aGuideRecord } from "@tests/fixtures/guide-record";
import { codesOf, validateRecord } from "@tests/fixtures/validate";

const IRRELEVANT_NOTES = [
  "Paciente chegou 10 min atrasado.",
  "Pediu recibo para reembolso do plano.",
  "Confirmado pelo WhatsApp na véspera.",
  "Trouxe exame novo, anexado ao prontuário.",
];

describe("heuristic interpreter", () => {
  it.each(IRRELEVANT_NOTES)("finds nothing to act on in %j", async (note) => {
    const interpretation = await heuristicObservationInterpreter.interpret(note);

    expect(interpretation.facts).toEqual([]);
    expect(interpretation.requiresReview).toBe(false);
  });

  it("asks for human review when it cannot classify the note", async () => {
    const interpretation = await heuristicObservationInterpreter.interpret(
      "Convênio pediu para reenviar junto com o relatório do mês.",
    );

    expect(interpretation.facts).toEqual([]);
    expect(interpretation.requiresReview).toBe(true);
  });

  it("quotes the sentence that supports each fact", async () => {
    const interpretation = await heuristicObservationInterpreter.interpret(
      "Paciente chegou atrasado. Paciente trouxe autorização nova, número ainda não lançado.",
    );

    expect(interpretation.facts).toEqual([
      {
        type: "NEW_AUTHORIZATION_REPORTED",
        evidence: "Paciente trouxe autorização nova, número ainda não lançado.",
        confidence: expect.any(Number),
      },
    ]);
  });
});

describe("irrelevant notes do not create findings", () => {
  it.each(IRRELEVANT_NOTES)("keeps a clean guide ready to submit with %j", async (note) => {
    const result = await validateRecord(aGuideRecord({ observacao_recepcao: note }));

    expect(result.findings).toEqual([]);
    expect(result.decision.status).toBe("READY_TO_SUBMIT");
  });
});

describe("notes reconciled against the rules", () => {
  it("does not invent a rule that rescheduling voids an authorization", async () => {
    const result = await validateRecord(
      aGuideRecord({
        observacao_recepcao: "Sessão remarcada de 12/08 para hoje, autorização era da data original.",
      }),
    );

    expect(codesOf(result)).toEqual(["SESSION_RESCHEDULED_NOTE"]);
    expect(result.decision.status).toBe("READY_TO_SUBMIT");
  });

  it("treats a reported but unregistered authorization as a correction", async () => {
    const result = await validateRecord(
      aGuideRecord({
        observacao_recepcao: "Paciente trouxe autorização nova, número ainda não lançado. Validade 30/09.",
      }),
    );

    expect(codesOf(result)).toContain("NEW_AUTHORIZATION_NOT_REGISTERED");
    expect(result.decision.status).toBe("NEEDS_CORRECTION");
  });

  it("sends a private-billing request to a human", async () => {
    const result = await validateRecord(
      aGuideRecord({
        observacao_recepcao: "Paciente pediu para faturar como particular, não quer usar o convênio.",
      }),
    );

    expect(codesOf(result)).toContain("PRIVATE_BILLING_REQUESTED");
    expect(result.decision.status).toBe("REVIEW_REQUIRED");
  });

  it("applies the verbal-authorization exception only as far as the rule goes", async () => {
    const result = await validateRecord(
      aGuideRecord({
        convenio: "Saúde Interior",
        cid: "",
        autorizacao_sessoes_limite: "20",
        numero_autorizacao: "",
        observacao_recepcao: "Autorizado por telefone, protocolo 771203, aguardando número.",
      }),
    );

    const verbal = result.findings.find(
      (finding) => finding.code === "VERBAL_AUTHORIZATION_PENDING_NUMBER",
    );

    expect(verbal?.severity).toBe("BLOCKING");
    expect(verbal?.evidence).toContain("protocolo 771203");
    expect(result.decision.status).toBe("NEEDS_CORRECTION");
  });

  it("does not assume other conventions accept verbal authorization", async () => {
    const result = await validateRecord(
      aGuideRecord({
        numero_autorizacao: "",
        observacao_recepcao: "Autorizado por telefone, protocolo 771203, aguardando número.",
      }),
    );

    const verbal = result.findings.find(
      (finding) => finding.code === "VERBAL_AUTHORIZATION_PENDING_NUMBER",
    );

    expect(verbal?.severity).toBe("REVIEW");
  });

  it("never guesses the correct code when the note contradicts the procedure", async () => {
    const result = await validateRecord(
      aGuideRecord({
        observacao_recepcao: "Procedimento realizado foi drenagem linfática, lançar o código certo.",
      }),
    );

    const finding = result.findings.find(
      (candidate) => candidate.code === "PROCEDURE_CONTRADICTED_BY_NOTE",
    );

    expect(finding?.expected).toBe("Código do procedimento efetivamente realizado");
    expect(result.decision.status).toBe("REVIEW_REQUIRED");
  });
});

describe("llm interpreter", () => {
  function clientReturning(text: string): TextCompletionClient {
    return { model: "test-model", complete: () => Promise.resolve(text) };
  }

  it("accepts a well-formed answer whose evidence is present in the note", async () => {
    const interpreter = createLlmObservationInterpreter({
      client: clientReturning(
        '{"facts":[{"type":"PRIVATE_BILLING_REQUESTED","evidence":"faturar como particular","confidence":0.9}],"requiresReview":false,"confidence":0.9}',
      ),
    });

    const interpretation = await interpreter.interpret(
      "Paciente pediu para faturar como particular.",
    );

    expect(interpretation.facts).toHaveLength(1);
    expect(interpreter.model).toBe("test-model");
  });

  it("discards a fact whose evidence is not in the note", async () => {
    const interpreter = createLlmObservationInterpreter({
      client: clientReturning(
        '{"facts":[{"type":"NEW_AUTHORIZATION_REPORTED","evidence":"autorização nova AUT999","confidence":0.99}],"requiresReview":false,"confidence":0.99}',
      ),
    });

    const interpretation = await interpreter.interpret("Paciente chegou 10 min atrasado.");

    expect(interpretation.facts).toEqual([]);
    expect(interpretation.requiresReview).toBe(true);
  });

  it("falls back to the heuristic when the model fails", async () => {
    const interpreter = createLlmObservationInterpreter({
      client: {
        model: "test-model",
        complete: () => Promise.reject(new Error("offline")),
      },
    });

    const interpretation = await interpreter.interpret(
      "Paciente pediu para faturar como particular, não quer usar o convênio.",
    );

    expect(interpretation.facts.map((fact) => fact.type)).toEqual([
      "PRIVATE_BILLING_REQUESTED",
    ]);
  });

  it("falls back when the model answers with something that is not JSON", async () => {
    const interpreter = createLlmObservationInterpreter({
      client: clientReturning("Não consegui analisar."),
    });

    const interpretation = await interpreter.interpret("Paciente chegou 10 min atrasado.");

    expect(interpretation).toEqual({ facts: [], requiresReview: false, confidence: 0.9 });
  });
});
