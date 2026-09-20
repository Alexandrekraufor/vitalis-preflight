import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 256 bits of CSPRNG output, URL-safe. Used for session and invitation tokens. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Tokens are stored as their SHA-256 digest.
 *
 * The token itself is high-entropy random, so a plain digest is enough - there
 * is nothing to brute-force the way there is with a password, and a stretching
 * KDF would only slow every request down.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Constant-time comparison for secrets compared in application code.
 *
 * Both sides are hashed first so the comparison runs over two fixed-length
 * buffers: an early `length` check would leak the size of the expected secret.
 */
export function secretsMatch(left: string, right: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(left, "utf8").digest(),
    createHash("sha256").update(right, "utf8").digest(),
  );
}
