import "server-only";

import { cookies } from "next/headers";

import type { SessionTokenFactory } from "@/application/access/authenticate.use-case";
import type { AuthenticatedUser } from "@/domain/access/access.types";
import { env } from "@/lib/env";

import { generateToken, hashToken } from "./tokens";

export const SESSION_COOKIE = "vitalis_session";

/** Eight hours: long enough for a shift, short enough that a stolen laptop ages out. */
export const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;

export const sessionTokens: SessionTokenFactory = {
  create: generateToken,
  hash: hashToken,
};

/**
 * Cookie attributes, in one place.
 *
 * `httpOnly` keeps the token away from any script on the page, which is what
 * makes an XSS bug a defacement rather than a session theft. `sameSite: lax`
 * blocks cross-site POSTs — the CSRF defence for every form in the app — while
 * still letting a member follow a link into the dashboard. `secure` is on
 * whenever the app is not served over plain local HTTP.
 */
function cookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: env().APP_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  } as const;
}

export async function writeSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", cookieOptions(new Date(0)));
}

/** Used from Server Components and Server Actions, which have no `Request`. */
export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * Used from route handlers, which do have the `Request`.
 *
 * Reading the header directly keeps handlers independent of Next's async
 * request storage — which is also what lets the authorization tests drive the
 * real handlers with a real cookie instead of a mocked module.
 */
export function readSessionTokenFromRequest(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (header === null) return null;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== SESSION_COOKIE) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }

  return null;
}

export interface ResolvedSession {
  readonly user: AuthenticatedUser;
  readonly sessionId: string;
  readonly token: string;
}
