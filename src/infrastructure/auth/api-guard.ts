import "server-only";

import type { AccessRepository } from "@/application/ports/access-repository.port";
import type { AuthenticatedUser, UserRole } from "@/domain/access/access.types";
import { forbidden, rateLimited, unauthorized } from "@/lib/api-problem";
import { clientKey, consumeRateLimit, type RateLimitRule } from "@/lib/rate-limit";

import { authenticateApiRequest, type ApiSurface } from "./api-credentials";
import { resolveSessionFromRequest } from "./guards";

const DEFAULT_RULE: RateLimitRule = { limit: 120, windowMs: 60_000 };

/**
 * Guard for the machine-facing surfaces.
 *
 * Returns a `Response` to send back, or `null` when the caller may proceed —
 * so a handler cannot forget the check and still compile into something that
 * answers with data.
 */
export function guardMachineRequest(
  request: Request,
  surface: ApiSurface,
  rule: RateLimitRule = DEFAULT_RULE,
): Response | null {
  const throttle = consumeRateLimit(clientKey(request, surface), rule);
  if (!throttle.allowed) return rateLimited(throttle.retryAfterSeconds);

  return authenticateApiRequest(request, surface).ok ? null : unauthorized();
}

export interface SessionGuardResult {
  readonly user: AuthenticatedUser;
}

/**
 * Guard for the dashboard's own endpoints.
 *
 * These are reached by the browser with a session cookie, never with an API
 * key, and they are the only machine surface that may write operational data.
 */
export async function guardSessionRequest(
  request: Request,
  access: AccessRepository,
  roles: readonly UserRole[],
): Promise<SessionGuardResult | Response> {
  const session = await resolveSessionFromRequest(request, access);
  if (session === null) return unauthorized();
  if (!roles.includes(session.user.role)) return forbidden();
  return { user: session.user };
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}
