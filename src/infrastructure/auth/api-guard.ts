import "server-only";

import { authenticateAccessToken } from "@/application/access/oauth-authorization.use-case";
import type { AccessRepository } from "@/application/ports/access-repository.port";
import type { AuthenticatedUser, UserRole } from "@/domain/access/access.types";
import type { RequestOutcome } from "@/domain/access/api-usage";
import type { AppServices } from "@/infrastructure/composition-root";
import {
  forbidden,
  rateLimited,
  unauthorized,
  unauthorizedWithResourceMetadata,
} from "@/lib/api-problem";
import { clientKey, consumeRateLimit, type RateLimitRule } from "@/lib/rate-limit";

import {
  authenticateApiRequest,
  authenticateValidationRequest,
  type ApiScope,
  type ApiSurface,
} from "./api-credentials";
import { resolveSessionFromRequest } from "./guards";
import { mcpResourceUrl, oauthDependencies } from "./oauth-secrets";

const DEFAULT_RULE: RateLimitRule = { limit: 120, windowMs: 60_000 };

/** Who the server decided was calling, in the terms the usage log records. */
export interface MachineCaller {
  readonly credentialId: string | null;
  readonly oauthClientId: string | null;
  readonly userId: string | null;
  /**
   * `DEMO` means the open validation endpoint answered without a credential.
   * A key configured in the environment is still `CREDENTIAL`, even though it
   * has no row of its own to point at.
   */
  readonly mode: "CREDENTIAL" | "DEMO";
}

const ANONYMOUS: MachineCaller = {
  credentialId: null,
  oauthClientId: null,
  userId: null,
  mode: "CREDENTIAL",
};

interface ServeOptions {
  readonly rule?: RateLimitRule;
  /** What the credential must be allowed to do. Defaults to reading. */
  readonly scope?: ApiScope;
  /** Only `POST /api/v1/guides/validate` may run without a credential. */
  readonly allowDemoMode?: boolean;
}

/**
 * Telemetry about a request, written after the response is decided.
 *
 * It is deliberately fire-and-forget and swallows its own failures: the usage
 * panel is worth a lot, but never worth turning a working API call into a 500.
 * What it stores is identifiers and outcomes, never a body, a header or a
 * token.
 */
async function recordUsage(
  services: AppServices,
  input: {
    readonly surface: ApiSurface;
    readonly method: string;
    readonly route: string;
    readonly status: number;
    readonly outcome: RequestOutcome;
    readonly startedAt: number;
    readonly caller: MachineCaller;
  },
): Promise<void> {
  try {
    await services.usage.record({
      surface: input.surface,
      method: input.method,
      route: input.route,
      status: input.status,
      outcome: input.outcome,
      durationMs: Math.max(0, Math.round(Date.now() - input.startedAt)),
      credentialId: input.caller.credentialId,
      oauthClientId: input.caller.oauthClientId,
      userId: input.caller.userId,
    });
  } catch {
    // A telemetry failure is not the caller's problem.
  }
}

/**
 * Runs a request against a machine-facing surface: throttle, authenticate,
 * serve, and log.
 *
 * Handlers receive the caller only after authentication succeeded, so a route
 * cannot forget the check and still compile into something that answers with
 * data.
 */
export async function serveMachineRequest(
  request: Request,
  surface: ApiSurface,
  route: string,
  services: AppServices,
  handle: (caller: MachineCaller) => Promise<Response>,
  options: ServeOptions = {},
): Promise<Response> {
  const startedAt = Date.now();
  const method = request.method;

  const throttle = consumeRateLimit(clientKey(request, surface), options.rule ?? DEFAULT_RULE);
  if (!throttle.allowed) {
    const response = rateLimited(throttle.retryAfterSeconds);
    await recordUsage(services, {
      surface,
      method,
      route,
      status: response.status,
      outcome: "RATE_LIMITED",
      startedAt,
      caller: ANONYMOUS,
    });
    return response;
  }

  const outcome =
    options.allowDemoMode === true
      ? await authenticateValidationRequest(request, services.access)
      : await authenticateApiRequest(request, surface, services.access, options.scope ?? "READ");

  if (!outcome.ok) {
    // A key that exists but may not write is a different answer from a key
    // that does not exist, and the caller needs to be able to tell them apart.
    const response = outcome.reason === "INSUFFICIENT_SCOPE" ? forbidden() : unauthorized();
    await recordUsage(services, {
      surface,
      method,
      route,
      status: response.status,
      outcome: "UNAUTHORIZED",
      startedAt,
      caller: ANONYMOUS,
    });
    return response;
  }

  const caller: MachineCaller = {
    credentialId: outcome.credentialId,
    oauthClientId: null,
    userId: null,
    mode: outcome.mode,
  };

  if (outcome.credentialId !== null) {
    await services.access.touchApiCredential(outcome.credentialId, new Date());
  }

  const response = await handle(caller);

  await recordUsage(services, {
    surface,
    method,
    route,
    status: response.status,
    outcome: "AUTHORIZED",
    startedAt,
    caller,
  });

  return response;
}

/**
 * The same, for the MCP endpoint, which accepts two kinds of credential.
 *
 * An OAuth access token is the path a client takes after someone approved it
 * on the consent screen; a static key is the path a server-to-server
 * integration takes. Neither present means 401 carrying the pointer to the
 * resource metadata, which is what tells an MCP client where to go and start
 * the authorization flow instead of simply failing.
 */
export async function serveMcpRequest(
  request: Request,
  services: AppServices,
  handle: (caller: MachineCaller) => Promise<Response>,
  rule: RateLimitRule = DEFAULT_RULE,
): Promise<Response> {
  const startedAt = Date.now();
  const method = request.method;
  const route = "/mcp";

  const throttle = consumeRateLimit(clientKey(request, "MCP"), rule);
  if (!throttle.allowed) {
    const response = rateLimited(throttle.retryAfterSeconds);
    await recordUsage(services, {
      surface: "MCP",
      method,
      route,
      status: response.status,
      outcome: "RATE_LIMITED",
      startedAt,
      caller: ANONYMOUS,
    });
    return response;
  }

  const metadataUrl = new URL(
    "/.well-known/oauth-protected-resource",
    mcpResourceUrl(),
  ).toString();

  const header = request.headers.get("authorization");
  const presented = header === null ? null : /^Bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim();

  const refuse = async (): Promise<Response> => {
    const response = unauthorizedWithResourceMetadata(metadataUrl);
    await recordUsage(services, {
      surface: "MCP",
      method,
      route,
      status: response.status,
      outcome: "UNAUTHORIZED",
      startedAt,
      caller: ANONYMOUS,
    });
    return response;
  };

  if (presented === null || presented === undefined || presented === "") return refuse();

  let caller: MachineCaller | null = null;

  const granted = await authenticateAccessToken(presented, oauthDependencies(services));
  if (granted !== null) {
    caller = {
      credentialId: null,
      oauthClientId: granted.grant.clientId,
      userId: granted.user.id,
      mode: "CREDENTIAL",
    };
  } else {
    const key = await authenticateApiRequest(request, "MCP", services.access);
    if (!key.ok) return refuse();

    if (key.credentialId !== null) {
      await services.access.touchApiCredential(key.credentialId, new Date());
    }
    caller = {
      credentialId: key.credentialId,
      oauthClientId: null,
      userId: null,
      mode: "CREDENTIAL",
    };
  }

  const response = await handle(caller);

  await recordUsage(services, {
    surface: "MCP",
    method,
    route,
    status: response.status,
    outcome: "AUTHORIZED",
    startedAt,
    caller,
  });

  return response;
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
