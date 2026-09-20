import "server-only";

import { redirect } from "next/navigation";

import type { AccessRepository } from "@/application/ports/access-repository.port";
import type { AuthenticatedUser, UserRole } from "@/domain/access/access.types";

import {
  readSessionToken,
  readSessionTokenFromRequest,
  sessionTokens,
  type ResolvedSession,
} from "./session";

/**
 * Resolves the caller from their session cookie.
 *
 * Everything that matters is decided here, on the server, against the database:
 * the cookie is an opaque lookup key and carries no claims of its own, so a
 * forged or edited cookie resolves to nothing rather than to a role. Expiry and
 * account status are part of the lookup query, not a check that could be
 * forgotten at a call site.
 */
export async function resolveSession(
  access: AccessRepository,
): Promise<ResolvedSession | null> {
  const token = await readSessionToken();
  if (token === null || token === "") return null;

  const session = await access.findSessionByTokenHash(sessionTokens.hash(token));
  if (session === null) return null;

  return { user: session.user, sessionId: session.id, token };
}

export async function getCurrentUser(
  access: AccessRepository,
): Promise<AuthenticatedUser | null> {
  return (await resolveSession(access))?.user ?? null;
}

/** Same resolution, for a route handler that holds the `Request`. */
export async function resolveSessionFromRequest(
  request: Request,
  access: AccessRepository,
): Promise<ResolvedSession | null> {
  const token = readSessionTokenFromRequest(request);
  if (token === null || token === "") return null;

  const session = await access.findSessionByTokenHash(sessionTokens.hash(token));
  if (session === null) return null;

  return { user: session.user, sessionId: session.id, token };
}

/**
 * Page guard: sends an anonymous visitor to the login screen.
 *
 * `next` carries where they were going so they land there after signing in. It
 * is only ever built from a path that starts with `/`, so it cannot be turned
 * into an open redirect to another origin.
 */
export async function requireUser(
  access: AccessRepository,
  returnTo?: string,
): Promise<AuthenticatedUser> {
  const user = await getCurrentUser(access);
  if (user !== null) return user;

  const safeReturn =
    returnTo !== undefined && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? `?next=${encodeURIComponent(returnTo)}`
      : "";

  redirect(`/login${safeReturn}`);
}

export function hasRole(user: AuthenticatedUser, roles: readonly UserRole[]): boolean {
  return roles.includes(user.role);
}

/**
 * Raised by action and route guards when an authenticated caller lacks the
 * role for what they asked. Carries the HTTP status the boundary should use, so
 * every adapter answers 401 and 403 the same way.
 */
export class AccessDeniedError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export function isAccessDeniedError(error: unknown): error is AccessDeniedError {
  return error instanceof AccessDeniedError;
}

/**
 * Server Action guard.
 *
 * Actions throw rather than redirect: a denied action must fail loudly instead
 * of quietly doing nothing, and the caller turns the error into a message.
 */
export async function requireUserForAction(
  access: AccessRepository,
): Promise<AuthenticatedUser> {
  const user = await getCurrentUser(access);
  if (user === null) {
    throw new AccessDeniedError(401, "É necessário entrar para executar esta ação.");
  }
  return user;
}

export async function requireAdminForAction(
  access: AccessRepository,
): Promise<AuthenticatedUser> {
  const user = await requireUserForAction(access);
  if (user.role !== "ADMIN") {
    throw new AccessDeniedError(403, "Esta ação é restrita a administradores.");
  }
  return user;
}
