import type { Money } from "@/lib/money";

/**
 * Fields a convention may demand before a guide can be submitted. The union is
 * closed on purpose: a rule file cannot introduce a requirement the engine does
 * not know how to check.
 */
export type RequiredFieldName =
  | "numero_autorizacao"
  | "autorizacao_validade"
  | "profissional_registro"
  | "carteirinha"
  | "cid";

export interface Procedure {
  readonly code: string;
  readonly description: string;
  readonly referenceValue: Money;
}

export interface Convention {
  readonly name: string;
  readonly requiredFields: readonly RequiredFieldName[];
  /**
   * Maximum lifespan of an authorization, counted from its issue date.
   * Not enforceable today — see `docs/assumptions.md`.
   */
  readonly maxAuthorizationValidityDays: number;
  readonly maxSessionsPerAuthorization: number;
  readonly coveredProcedureCodes: readonly string[];
  /**
   * Maximum delay between the appointment and the submission to the convention.
   * Not enforceable today — see `docs/assumptions.md`.
   */
  readonly submissionDeadlineDays: number;
  /** Verbatim rule text, surfaced to humans and agents without reinterpretation. */
  readonly note: string;
}

/**
 * The complete, immutable rule set the engine ran against. `version` and `hash`
 * travel with every decision so an audit can reproduce it exactly.
 */
export interface RuleSet {
  readonly version: string;
  readonly hash: string;
  readonly procedures: ReadonlyMap<string, Procedure>;
  readonly conventions: ReadonlyMap<string, Convention>;
}
