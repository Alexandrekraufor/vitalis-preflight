/**
 * Shape of the login form's action state.
 *
 * It lives outside `actions.ts` because a `"use server"` module may only export
 * async functions: a plain constant exported from one is turned into a server
 * reference, which is not the object the client expects.
 */
export interface LoginState {
  readonly error: string | null;
}

export const INITIAL_LOGIN_STATE: LoginState = { error: null };
