import type { ObservationInterpretation } from "./observation-facts";

/**
 * Reads the receptionist's free-text note and reports *facts*, never verdicts.
 *
 * Implementations live in `infrastructure/observations`: a deterministic
 * heuristic one and a model-backed one. The domain depends on this port only,
 * so no provider name ever reaches a business rule.
 */
export interface ObservationInterpreter {
  /** Stored on every validation run so a decision can be reproduced. */
  readonly name: string;
  /** Model identifier when one was used, `null` otherwise. */
  readonly model: string | null;
  interpret(note: string): Promise<ObservationInterpretation>;
}
