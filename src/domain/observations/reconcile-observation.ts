import type { Finding } from "@/domain/rules/finding";
import type { RuleContext } from "@/domain/rules/rules.types";

import type { ObservationFact, ObservationInterpretation } from "./observation-facts";

const VERBAL_AUTHORIZATION_CONVENTIONS_NOTE_HINT = /autoriza[çc][ãa]o verbal/i;

/**
 * Turns interpreter facts into findings. This is where a fact meets the
 * convention's own text and the guide's structured data - the model reports
 * what the note says, this function decides what that means, using only rules
 * that actually exist.
 */
function toFinding(fact: ObservationFact, context: RuleContext): Finding | null {
  const { guide, convention } = context;

  switch (fact.type) {
    case "NEW_AUTHORIZATION_REPORTED":
      return {
        code: "NEW_AUTHORIZATION_NOT_REGISTERED",
        severity: "BLOCKING",
        field: "numero_autorizacao",
        message:
          "A observação informa uma autorização nova que ainda não está lançada na guia. O envio usa os dados estruturados, não a observação.",
        expected: "Número e validade da nova autorização lançados na guia",
        actual: guide.authorizationNumber,
        source: "RECEPTION_NOTE",
        evidence: fact.evidence,
        recommendedAction:
          "Lançar número e validade da nova autorização antes do envio.",
      };

    case "PRIVATE_BILLING_REQUESTED":
      return {
        code: "PRIVATE_BILLING_REQUESTED",
        severity: "REVIEW",
        field: "convenio",
        message:
          "O paciente pediu faturamento particular, mas a guia está lançada com convênio. Enviar ao convênio contraria o pedido registrado.",
        expected: "Definição de como faturar",
        actual: guide.conventionName,
        source: "RECEPTION_NOTE",
        evidence: fact.evidence,
        recommendedAction:
          "Confirmar com o paciente e refaturar como particular, ou retirar a guia do envio.",
      };

    case "VERBAL_AUTHORIZATION_REPORTED": {
      const conventionAllowsVerbal =
        convention !== null &&
        VERBAL_AUTHORIZATION_CONVENTIONS_NOTE_HINT.test(convention.note);

      if (guide.authorizationNumber !== null) {
        return {
          code: "VERBAL_AUTHORIZATION_PENDING_NUMBER",
          severity: "INFO",
          field: "numero_autorizacao",
          message:
            "A observação cita autorização verbal, e a guia já tem número de autorização lançado.",
          expected: null,
          actual: guide.authorizationNumber,
          source: "RECEPTION_NOTE",
          evidence: fact.evidence,
          recommendedAction: null,
        };
      }

      return conventionAllowsVerbal
        ? {
            code: "VERBAL_AUTHORIZATION_PENDING_NUMBER",
            severity: "BLOCKING",
            field: "numero_autorizacao",
            message: `${convention?.name ?? "O convênio"} aceita autorização verbal com protocolo, mas exige que o número seja lançado antes do envio.`,
            expected: "Número da autorização lançado na guia",
            actual: null,
            source: "RECEPTION_NOTE",
            evidence: fact.evidence,
            recommendedAction:
              "Obter o número definitivo junto ao convênio e lançá-lo antes do envio.",
          }
        : {
            code: "VERBAL_AUTHORIZATION_PENDING_NUMBER",
            severity: "REVIEW",
            field: "numero_autorizacao",
            message: `As regras de ${convention?.name ?? "convênio desconhecido"} não preveem autorização verbal. A situação precisa ser confirmada com o convênio.`,
            expected: "Número da autorização lançado na guia",
            actual: null,
            source: "RECEPTION_NOTE",
            evidence: fact.evidence,
            recommendedAction:
              "Confirmar com o convênio se a autorização verbal é aceita antes do envio.",
          };
    }

    case "PROCEDURE_MISMATCH_REPORTED":
      return {
        code: "PROCEDURE_CONTRADICTED_BY_NOTE",
        severity: "REVIEW",
        field: "procedimento_codigo",
        message:
          "A observação diz que o procedimento realizado foi outro. O código correto não pode ser deduzido pelo sistema.",
        expected: "Código do procedimento efetivamente realizado",
        actual: guide.procedureCode,
        source: "RECEPTION_NOTE",
        evidence: fact.evidence,
        recommendedAction:
          "Confirmar com o profissional qual procedimento foi realizado e lançar o código correspondente.",
      };

    case "SESSION_RESCHEDULED":
      return {
        code: "SESSION_RESCHEDULED_NOTE",
        severity: "INFO",
        field: "data_atendimento",
        message:
          "A observação menciona remarcação. Nenhuma regra dos convênios trata remarcação, então isso não altera a decisão.",
        expected: null,
        actual: null,
        source: "RECEPTION_NOTE",
        evidence: fact.evidence,
        recommendedAction: null,
      };
  }
}

export function reconcileObservation(
  interpretation: ObservationInterpretation,
  context: RuleContext,
): readonly Finding[] {
  const findings = interpretation.facts
    .map((fact) => toFinding(fact, context))
    .filter((finding): finding is Finding => finding !== null);

  const alreadyRaisesAttention = findings.some(
    (finding) => finding.severity !== "INFO",
  );

  if (interpretation.requiresReview && !alreadyRaisesAttention) {
    const note = context.guide.receptionNote;
    findings.push({
      code: "NOTE_REQUIRES_HUMAN_REVIEW",
      severity: "REVIEW",
      field: "observacao_recepcao",
      message:
        "A observação da recepção não pôde ser interpretada com segurança e precisa de leitura humana.",
      expected: null,
      actual: null,
      source: "RECEPTION_NOTE",
      evidence: note,
      recommendedAction: "Ler a observação e decidir antes do envio.",
    });
  }

  return findings;
}
