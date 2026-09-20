import "server-only";

import { createHash } from "node:crypto";

import type { OAuthDependencies, SecretFactory } from "@/application/access/oauth-authorization.use-case";
import type { AppServices } from "@/infrastructure/composition-root";
import { env } from "@/lib/env";

import { generateToken, hashToken } from "./tokens";

/**
 * Secret handling for the authorization server.
 *
 * `challengeFor` is PKCE `S256` exactly as the specification defines it: the
 * base64url of the SHA-256 of the verifier, with no padding. Storage uses the
 * same digest helper as sessions and invitations.
 */
export const oauthSecrets: SecretFactory = {
  generate: generateToken,
  hash: hashToken,
  challengeFor: (verifier: string): string =>
    createHash("sha256").update(verifier, "ascii").digest("base64url"),
};

/** Absolute URL of the protected resource, which is what tokens are minted for. */
export function mcpResourceUrl(): string {
  return new URL("/mcp", env().APP_URL).toString();
}

export function oauthDependencies(services: AppServices): OAuthDependencies {
  return {
    oauth: services.oauth,
    access: services.access,
    secrets: oauthSecrets,
    resource: mcpResourceUrl(),
  };
}
