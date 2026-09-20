import "server-only";

import { env } from "@/lib/env";

import { secretsMatch } from "./tokens";

export type ApiSurface = "REST" | "MCP";

export type ApiAuthOutcome =
  | { readonly ok: true; readonly mode: "CREDENTIAL" | "DEMO" }
  | { readonly ok: false; readonly reason: "MISSING" | "INVALID" | "NOT_CONFIGURED" };

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header === null) return null;

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? null;
}

function expectedKeyFor(surface: ApiSurface): string | undefined {
  return surface === "REST" ? env().VITALIS_API_KEY : env().VITALIS_MCP_API_KEY;
}

/**
 * Checks the Bearer credential for a machine-facing surface.
 *
 * When no key is configured the surface is **closed**, not open: a missing
 * environment variable must never be the thing that publishes an API. The
 * comparison is constant-time so a caller cannot narrow the key down one byte
 * at a time by timing responses.
 */
export function authenticateApiRequest(
  request: Request,
  surface: ApiSurface,
): ApiAuthOutcome {
  const expected = expectedKeyFor(surface);
  if (expected === undefined) return { ok: false, reason: "NOT_CONFIGURED" };

  const presented = bearerToken(request);
  if (presented === null) return { ok: false, reason: "MISSING" };

  return secretsMatch(presented, expected)
    ? { ok: true, mode: "CREDENTIAL" }
    : { ok: false, reason: "INVALID" };
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
export function authenticateValidationRequest(request: Request): ApiAuthOutcome {
  const credential = authenticateApiRequest(request, "REST");
  if (credential.ok) return credential;

  return env().VITALIS_API_DEMO_MODE
    ? { ok: true, mode: "DEMO" }
    : credential;
}
