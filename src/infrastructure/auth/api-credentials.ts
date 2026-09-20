import "server-only";

import type { AccessRepository } from "@/application/ports/access-repository.port";
import { allowsScope, type ApiScope, type ApiSurface } from "@/domain/access/api-credential";
import { env } from "@/lib/env";

import { hashToken, secretsMatch } from "./tokens";

export type { ApiScope, ApiSurface };

export type ApiAuthOutcome =
  | {
      readonly ok: true;
      readonly mode: "CREDENTIAL" | "DEMO";
      /** Set when the credential came from the database, so its use can be stamped. */
      readonly credentialId: string | null;
    }
  | {
      readonly ok: false;
      readonly reason: "MISSING" | "INVALID" | "NOT_CONFIGURED" | "INSUFFICIENT_SCOPE";
    };

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header === null) return null;

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? null;
}

function environmentKeyFor(surface: ApiSurface): string | undefined {
  return surface === "REST" ? env().VITALIS_API_KEY : env().VITALIS_MCP_API_KEY;
}

/**
 * Checks the Bearer credential for a machine-facing surface.
 *
 * Two sources are accepted, in this order: the key issued from the dashboard
 * and stored as a digest, and the key configured in the environment. Neither
 * being present leaves the surface **closed** - a missing credential must
 * never be the thing that publishes an API.
 *
 * The environment comparison is constant-time so a caller cannot narrow the
 * key down one byte at a time by timing responses. The stored credential is
 * looked up by digest, which is a single indexed equality and leaks nothing
 * about other keys.
 */
export async function authenticateApiRequest(
  request: Request,
  surface: ApiSurface,
  access: AccessRepository,
  requiredScope: ApiScope = "READ",
): Promise<ApiAuthOutcome> {
  const presented = bearerToken(request);
  const expected = environmentKeyFor(surface);

  if (presented === null) {
    return expected === undefined
      ? { ok: false, reason: "NOT_CONFIGURED" }
      : { ok: false, reason: "MISSING" };
  }

  const stored = await access.findApiCredentialByTokenHash(hashToken(presented));

  if (stored !== null && stored.surface === surface && stored.revokedAt === null) {
    return allowsScope(stored.scopes, requiredScope)
      ? { ok: true, mode: "CREDENTIAL", credentialId: stored.id }
      : { ok: false, reason: "INSUFFICIENT_SCOPE" };
  }

  if (expected !== undefined && secretsMatch(presented, expected)) {
    // A key configured in the environment reads and nothing else: writing into
    // the clinic's data takes a credential somebody deliberately issued for it.
    return requiredScope === "READ"
      ? { ok: true, mode: "CREDENTIAL", credentialId: null }
      : { ok: false, reason: "INSUFFICIENT_SCOPE" };
  }

  return { ok: false, reason: expected === undefined && stored === null ? "NOT_CONFIGURED" : "INVALID" };
}

/**
 * Authentication for the one endpoint that may run without a credential.
 *
 * Demo mode covers `POST /api/v1/guides/validate` only. That endpoint is a pure
 * computation over the payload the caller already holds: it reads no stored
 * guide, writes no guide, and returns nothing the caller did not send plus the
 * published rules. Everything else on `/api/v1` stays credential-only, and demo
 * mode is rejected outright in production by the environment schema.
 */
export async function authenticateValidationRequest(
  request: Request,
  access: AccessRepository,
): Promise<ApiAuthOutcome> {
  const credential = await authenticateApiRequest(request, "REST", access);
  if (credential.ok) return credential;

  return env().VITALIS_API_DEMO_MODE
    ? { ok: true, mode: "DEMO", credentialId: null }
    : credential;
}
