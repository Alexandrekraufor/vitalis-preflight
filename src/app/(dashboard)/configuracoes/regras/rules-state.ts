/** Kept out of `actions.ts`: a `"use server"` module may only export functions. */
export interface RuleActionState {
  readonly error: string | null;
  readonly notice: string | null;
}

export const INITIAL_RULE_STATE: RuleActionState = { error: null, notice: null };
