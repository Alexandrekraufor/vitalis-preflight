/**
 * OAuth 2.1 as the Model Context Protocol requires it.
 *
 * An MCP client is handed a URL and nothing else: it discovers this server,
 * registers itself, sends the person here to approve, and receives a token
 * scoped to this deployment. Nobody copies a secret by hand, and an approval
 * can be withdrawn without changing a key that other integrations share.
 *
 * Everything here is vocabulary and rules. Storage, hashing and HTTP live in
 * the adapters.
 */

/** The only scope this server publishes. Every MCP tool is read-only. */
export const MCP_SCOPE = "mcp:read";

export const SUPPORTED_SCOPES = [MCP_SCOPE] as const;

export type OAuthScope = (typeof SUPPORTED_SCOPES)[number];

/** PKCE is mandatory, and only the hashed challenge is accepted. */
export const SUPPORTED_CODE_CHALLENGE_METHODS = ["S256"] as const;

export type CodeChallengeMethod = (typeof SUPPORTED_CODE_CHALLENGE_METHODS)[number];

export const TOKEN_KINDS = ["ACCESS", "REFRESH"] as const;

export type TokenKind = (typeof TOKEN_KINDS)[number];

/**
 * Lifetimes.
 *
 * The authorization code is short because it travels through a browser
 * redirect; the access token is short because it cannot be revoked mid-flight;
 * the refresh token is long because it can, and is rotated on every use.
 */
export const AUTHORIZATION_REQUEST_TTL_SECONDS = 10 * 60;
export const AUTHORIZATION_CODE_TTL_SECONDS = 60;
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface OAuthClient {
  readonly id: string;
  readonly name: string;
  readonly redirectUris: readonly string[];
  readonly createdAt: Date;
}

/** A pending consent: validated parameters waiting for the person to decide. */
export interface AuthorizationRequest {
  readonly id: string;
  readonly clientId: string;
  readonly clientName: string;
  readonly userId: string;
  readonly redirectUri: string;
  readonly scope: string;
  readonly state: string | null;
  readonly codeChallenge: string;
  readonly resource: string | null;
  readonly expiresAt: Date;
}

/** An access or refresh token as the server reads it back. */
export interface TokenGrant {
  readonly id: string;
  readonly kind: TokenKind;
  readonly clientId: string;
  readonly userId: string;
  readonly scope: string;
  readonly resource: string | null;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
}

export function isExpired(at: Date, now: Date = new Date()): boolean {
  return at.getTime() <= now.getTime();
}

export function isUsable(grant: TokenGrant, now: Date = new Date()): boolean {
  return grant.revokedAt === null && !isExpired(grant.expiresAt, now);
}

/**
 * Exact string match, as OAuth 2.1 requires.
 *
 * No prefix matching and no wildcards: a redirect target that is merely
 * "close enough" is how an authorization code ends up at somebody else's
 * server.
 */
export function redirectUriAllowed(client: OAuthClient, redirectUri: string): boolean {
  return client.redirectUris.includes(redirectUri);
}

/**
 * A redirect target this server is willing to send a person to.
 *
 * Loopback addresses cover desktop clients that listen on an ephemeral port,
 * https covers hosted ones, and a private-use scheme covers native apps. Plain
 * http to anywhere else is refused: the code would cross the network in the
 * clear.
 */
export function isAcceptableRedirectUri(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.hash !== "") return false;

  if (url.protocol === "https:") return true;

  if (url.protocol === "http:") {
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  }

  // A private-use scheme such as `cursor://` or `claude://`: it has no
  // authority component to spoof and is resolved by the operating system.
  return /^[a-z][a-z0-9+.-]*:$/.test(url.protocol) && url.protocol !== "javascript:";
}

/** Scopes the client asked for, narrowed to what this server actually grants. */
export function negotiateScope(requested: string | null): string {
  if (requested === null || requested.trim() === "") return MCP_SCOPE;

  const granted = requested
    .split(/\s+/)
    .filter((scope): scope is OAuthScope => SUPPORTED_SCOPES.includes(scope as OAuthScope));

  return granted.length === 0 ? MCP_SCOPE : [...new Set(granted)].join(" ");
}
