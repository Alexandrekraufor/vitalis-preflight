/**
 * Explicit success/failure channel for operations whose failure is an expected
 * outcome (bad CSV, unparseable payload) rather than a programming error.
 * Thrown exceptions stay reserved for the unexpected.
 */
export type Result<TValue, TError> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: TError };

export function ok<TValue>(value: TValue): Result<TValue, never> {
  return { ok: true, value };
}

export function err<TError>(error: TError): Result<never, TError> {
  return { ok: false, error };
}
