import "server-only";

import { randomBytes } from "node:crypto";

import { hash, verify } from "@node-rs/argon2";

/**
 * argon2id with the parameters OWASP recommends for interactive logins
 * (19 MiB of memory, 2 iterations, 1 lane). The salt is generated per hash by
 * the library and embedded in the encoded digest, so there is no salt handling
 * — and no opportunity to get it wrong — in this codebase.
 *
 * `algorithm` is left at the library default, which is argon2id. The default is
 * not taken on trust: a unit test asserts the produced digest carries the
 * `$argon2id$` prefix and these exact parameters.
 */
const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/**
 * Verifies a password against a stored digest.
 *
 * A malformed or missing digest resolves to `false` rather than throwing, so a
 * corrupted row cannot turn into a 500 that distinguishes it from a wrong
 * password.
 */
export async function verifyPassword(
  digest: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(digest, password);
  } catch {
    return false;
  }
}

/**
 * Digest of a value nobody knows, computed once per process.
 *
 * Generated rather than hard-coded so it is guaranteed to be a well-formed
 * argon2 digest — a malformed constant would fail to parse and return early,
 * which is exactly the timing difference this is meant to remove.
 */
let dummyDigest: Promise<string> | undefined;

/**
 * Burns roughly the same time as a real verification.
 *
 * Called when no user matches the submitted address, so that "unknown e-mail"
 * and "wrong password" cannot be told apart by how long the response takes.
 */
export async function simulatePasswordVerification(): Promise<void> {
  dummyDigest ??= hashPassword(randomBytes(32).toString("base64url"));
  await verifyPassword(await dummyDigest, "not-the-password");
}
