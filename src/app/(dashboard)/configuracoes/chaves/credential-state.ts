/** Kept out of `actions.ts`: a `"use server"` module may only export functions. */
export interface CredentialActionState {
  readonly error: string | null;
  readonly notice: string | null;
  /**
   * The freshly issued secret, returned exactly once so the page can show it.
   * It is never stored in the clear and never comes back from a later read.
   */
  readonly issuedToken: string | null;
  readonly issuedName: string | null;
}

export const INITIAL_CREDENTIAL_STATE: CredentialActionState = {
  error: null,
  notice: null,
  issuedToken: null,
  issuedName: null,
};
