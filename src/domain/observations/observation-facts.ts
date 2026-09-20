import { z } from "zod";

/**
 * The closed set of situations the interpreter may report. A model can only
 * recognize one of these — it can never introduce a new kind of problem, and it
 * never decides anything: the reconciliation step turns facts into findings.
 */
export const OBSERVATION_FACT_TYPES = [
  "NEW_AUTHORIZATION_REPORTED",
  "PRIVATE_BILLING_REQUESTED",
  "VERBAL_AUTHORIZATION_REPORTED",
  "PROCEDURE_MISMATCH_REPORTED",
  "SESSION_RESCHEDULED",
] as const;

export type ObservationFactType = (typeof OBSERVATION_FACT_TYPES)[number];

export const observationFactSchema = z.object({
  type: z.enum(OBSERVATION_FACT_TYPES),
  /** Verbatim excerpt of the note. Without it the fact is not usable. */
  evidence: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export const observationInterpretationSchema = z.object({
  facts: z.array(observationFactSchema),
  /** The note says something the interpreter cannot classify with confidence. */
  requiresReview: z.boolean(),
  confidence: z.number().min(0).max(1),
});

export type ObservationFact = z.infer<typeof observationFactSchema>;
export type ObservationInterpretation = z.infer<typeof observationInterpretationSchema>;

export const EMPTY_INTERPRETATION: ObservationInterpretation = {
  facts: [],
  requiresReview: false,
  confidence: 1,
};
