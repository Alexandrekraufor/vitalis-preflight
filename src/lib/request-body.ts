import { err, ok, type Result } from "./result";

/**
 * Size ceilings for anything that arrives from outside.
 *
 * A JSON guide is a few hundred bytes; a full clinic export of a month is a few
 * hundred kilobytes. These are generous against real use and cheap against
 * someone streaming a gigabyte at the validator.
 */
export const MAX_JSON_BODY_BYTES = 64 * 1024;
export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 20_000;

export type BodyRejection = "TOO_LARGE" | "UNREADABLE";

/**
 * Reads a request body without trusting `Content-Length`.
 *
 * The declared length is checked first as a cheap rejection, then the bytes are
 * counted as they arrive — a chunked request can claim any length it likes, or
 * none at all.
 */
export async function readBoundedText(
  request: Request,
  maxBytes: number,
): Promise<Result<string, BodyRejection>> {
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > maxBytes) return err("TOO_LARGE");

  const body = request.body;
  if (body === null) return ok("");

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value === undefined) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return err("TOO_LARGE");
      }
      chunks.push(value);
    }
  } catch {
    return err("UNREADABLE");
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return ok(new TextDecoder().decode(merged));
}
