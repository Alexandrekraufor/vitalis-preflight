/** Kept out of `actions.ts`: a `"use server"` module may only export functions. */
export interface TeamActionState {
  readonly error: string | null;
  readonly notice: string | null;
  /**
   * Development convenience only: with no mail provider configured, an
   * administrator still needs a way to hand the link over. The use case refuses
   * to populate this in production.
   */
  readonly inviteUrl: string | null;
}

export const INITIAL_TEAM_STATE: TeamActionState = {
  error: null,
  notice: null,
  inviteUrl: null,
};
