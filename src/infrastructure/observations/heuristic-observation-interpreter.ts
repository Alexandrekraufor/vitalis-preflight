import {
  EMPTY_INTERPRETATION,
  type ObservationFact,
  type ObservationFactType,
  type ObservationInterpretation,
} from "@/domain/observations/observation-facts";
import type { ObservationInterpreter } from "@/domain/observations/observation-interpreter.port";

interface Pattern {
  readonly type: ObservationFactType;
  readonly matcher: RegExp;
  readonly confidence: number;
}

/**
 * Deterministic reading of the reception notes. It exists for three reasons:
 * the application must work with no model available, every test must be
 * reproducible, and the model-backed interpreter needs a fallback.
 *
 * Patterns are intentionally narrow. A note this does not recognize produces no
 * facts at all — silence is correct, invention is not.
 */
const PATTERNS: readonly Pattern[] = [
  {
    type: "NEW_AUTHORIZATION_REPORTED",
    matcher: /autoriza[çc][ãa]o\s+nova|nova\s+autoriza[çc][ãa]o/i,
    confidence: 0.95,
  },
  {
    type: "PRIVATE_BILLING_REQUESTED",
    matcher: /faturar\s+como\s+particular|n[ãa]o\s+quer\s+usar\s+o\s+conv[êe]nio/i,
    confidence: 0.95,
  },
  {
    type: "VERBAL_AUTHORIZATION_REPORTED",
    matcher: /autorizado\s+por\s+telefone|autoriza[çc][ãa]o\s+verbal/i,
    confidence: 0.9,
  },
  {
    type: "PROCEDURE_MISMATCH_REPORTED",
    matcher: /procedimento\s+realizado\s+foi|lan[çc]ar\s+o\s+c[óo]digo\s+certo/i,
    confidence: 0.9,
  },
  {
    type: "SESSION_RESCHEDULED",
    matcher: /remarcad[ao]/i,
    confidence: 0.85,
  },
];

/**
 * Notes the clinic writes constantly and that carry no validation meaning.
 * Listing them explicitly keeps them out of `requiresReview`, so routine
 * bookkeeping never turns into an exception on Carla's queue.
 */
const KNOWN_IRRELEVANT =
  /chegou\s+\d+\s*min|pediu\s+recibo|confirmado\s+pelo\s+whatsapp|trouxe\s+exame/i;

function splitSentences(note: string): readonly string[] {
  return note
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/** The excerpt that triggered the match, so every fact carries its evidence. */
function evidenceFor(note: string, matcher: RegExp): string {
  const sentences = splitSentences(note);
  return sentences.find((sentence) => matcher.test(sentence)) ?? note;
}

function interpretNote(note: string): ObservationInterpretation {
  const trimmed = note.trim();
  if (trimmed === "") return EMPTY_INTERPRETATION;

  const facts: ObservationFact[] = PATTERNS.filter((pattern) =>
    pattern.matcher.test(trimmed),
  ).map((pattern) => ({
    type: pattern.type,
    evidence: evidenceFor(trimmed, pattern.matcher),
    confidence: pattern.confidence,
  }));

  if (facts.length > 0) {
    const confidence = Math.min(...facts.map((fact) => fact.confidence));
    return { facts, requiresReview: false, confidence };
  }

  const recognizedAsIrrelevant = KNOWN_IRRELEVANT.test(trimmed);

  return {
    facts: [],
    requiresReview: !recognizedAsIrrelevant,
    confidence: recognizedAsIrrelevant ? 0.9 : 0.4,
  };
}

export const heuristicObservationInterpreter: ObservationInterpreter = {
  name: "heuristic",
  model: null,
  interpret(note: string): Promise<ObservationInterpretation> {
    return Promise.resolve(interpretNote(note));
  },
};
