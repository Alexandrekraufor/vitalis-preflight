/** Kept out of `actions.ts`: a `"use server"` module may only export functions. */
export interface AcceptInviteState {
  readonly error: string | null;
}

export const INITIAL_ACCEPT_STATE: AcceptInviteState = { error: null };
