import {
  OBSERVATION_FACT_TYPES,
  observationInterpretationSchema,
  type ObservationInterpretation,
} from "@/domain/observations/observation-facts";
import type { ObservationInterpreter } from "@/domain/observations/observation-interpreter.port";
import type { TextCompletionClient } from "@/infrastructure/llm/text-completion.port";

import { heuristicObservationInterpreter } from "./heuristic-observation-interpreter";

const SYSTEM_PROMPT = `Você extrai fatos de observações escritas por recepcionistas de uma clínica.

Regras absolutas:
- Você NUNCA decide se a guia pode ser enviada.
- Você NUNCA cria regra de convênio.
- Você só reporta fatos dos tipos: ${OBSERVATION_FACT_TYPES.join(", ")}.
- Toda evidência deve ser um trecho copiado LITERALMENTE da observação.
- Observações operacionais irrelevantes (atraso, recibo, confirmação por WhatsApp, exame anexado) não geram fato algum e não exigem revisão.
- Se a observação não se encaixar em nenhum tipo e mesmo assim parecer relevante para o faturamento, use requiresReview = true.

Responda APENAS com JSON no formato:
{"facts":[{"type":"...","evidence":"...","confidence":0.0}],"requiresReview":false,"confidence":0.0}`;

function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("Resposta do modelo não contém JSON.");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function comparable(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Drops any fact whose evidence is not literally present in the note. This is
 * the guard that makes a hallucinated quote unable to reach a decision: no
 * evidence, no finding.
 */
function keepGroundedFacts(
  interpretation: ObservationInterpretation,
  note: string,
): ObservationInterpretation {
  const haystack = comparable(note);
  const grounded = interpretation.facts.filter((fact) =>
    haystack.includes(comparable(fact.evidence)),
  );

  const droppedSomething = grounded.length !== interpretation.facts.length;

  return {
    facts: grounded,
    requiresReview: interpretation.requiresReview || droppedSomething,
    confidence: droppedSomething
      ? Math.min(interpretation.confidence, 0.5)
      : interpretation.confidence,
  };
}

export interface LlmObservationInterpreterOptions {
  readonly client: TextCompletionClient;
  /** Used when the model is unreachable or answers something unusable. */
  readonly fallback?: ObservationInterpreter;
}

export function createLlmObservationInterpreter({
  client,
  fallback = heuristicObservationInterpreter,
}: LlmObservationInterpreterOptions): ObservationInterpreter {
  return {
    name: "llm",
    model: client.model,
    async interpret(note: string): Promise<ObservationInterpretation> {
      try {
        const raw = await client.complete({
          system: SYSTEM_PROMPT,
          user: `Observação da recepção:\n"""${note}"""`,
          maxOutputTokens: 600,
        });

        const parsed = observationInterpretationSchema.parse(extractJsonObject(raw));
        return keepGroundedFacts(parsed, note);
      } catch {
        return fallback.interpret(note);
      }
    },
  };
}
