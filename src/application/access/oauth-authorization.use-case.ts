import type { AccessRepository } from "@/application/ports/access-repository.port";
import type { OAuthRepository } from "@/application/ports/oauth-repository.port";
import type { AuthenticatedUser } from "@/domain/access/access.types";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTHORIZATION_CODE_TTL_SECONDS,
  AUTHORIZATION_REQUEST_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  isAcceptableRedirectUri,
  isExpired,
  isUsable,
  negotiateScope,
  redirectUriAllowed,
  type AuthorizationRequest,
  type OAuthClient,
  type TokenGrant,
} from "@/domain/access/oauth";
import { err, ok, type Result } from "@/lib/result";

/**
 * The authorization server behind the MCP endpoint.
 *
 * Every rule that decides whether a client may act on someone's behalf lives
 * here, once: the HTTP routes only translate to and from the wire. The code
 * and the tokens reach this module already generated, and leave it only as
 * digests, so the layer that persists them never sees a usable secret.
 */
export interface SecretFactory {
  readonly generate: () => string;
  readonly hash: (value: string) => string;
  /** SHA-256 of the verifier, base64url, which is what PKCE `S256` means. */
  readonly challengeFor: (verifier: string) => string;
}

export interface OAuthDependencies {
  readonly oauth: OAuthRepository;
  readonly access: AccessRepository;
  readonly secrets: SecretFactory;
  /** Absolute URL of the MCP endpoint, used as the audience of every token. */
  readonly resource: string;
}

export type RegistrationFailure = "INVALID_REDIRECT_URI" | "INVALID_CLIENT_NAME";

const MAX_CLIENT_NAME = 120;
const MAX_REDIRECT_URIS = 10;

export async function registerOAuthClient(
  input: { readonly name: string; readonly redirectUris: readonly string[] },
  { oauth }: Pick<OAuthDependencies, "oauth">,
): Promise<Result<OAuthClient, RegistrationFailure>> {
  const name = input.name.trim();
  if (name === "" || name.length > MAX_CLIENT_NAME) return err("INVALID_CLIENT_NAME");

  if (
    input.redirectUris.length === 0 ||
    input.redirectUris.length > MAX_REDIRECT_URIS ||
    !input.redirectUris.every(isAcceptableRedirectUri)
  ) {
    return err("INVALID_REDIRECT_URI");
  }

  return ok(await oauth.registerClient({ name, redirectUris: input.redirectUris }));
}

export interface AuthorizationParams {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly responseType: string;
  readonly codeChallenge: string | null;
  readonly codeChallengeMethod: string | null;
  readonly scope: string | null;
  readonly state: string | null;
  readonly resource: string | null;
}

/**
 * Failures that must never be sent back to the client's redirect target.
 *
 * When the client or the redirect target itself is wrong, redirecting would
 * mean sending an error to an address nobody vouched for, so these are shown
 * on this site instead.
 */
export type AuthorizationFailure =
  | "UNKNOWN_CLIENT"
  | "INVALID_REDIRECT_URI"
  | "UNSUPPORTED_RESPONSE_TYPE"
  | "PKCE_REQUIRED"
  | "RESOURCE_MISMATCH";

export async function beginAuthorization(
  params: AuthorizationParams,
  user: AuthenticatedUser,
  { oauth, resource }: OAuthDependencies,
): Promise<Result<AuthorizationRequest, AuthorizationFailure>> {
  const client = await oauth.findClient(params.clientId);
  if (client === null) return err("UNKNOWN_CLIENT");
  if (!redirectUriAllowed(client, params.redirectUri)) return err("INVALID_REDIRECT_URI");

  if (params.responseType !== "code") return err("UNSUPPORTED_RESPONSE_TYPE");

  // PKCE is not optional in OAuth 2.1, and `plain` is not accepted: without a
  // hashed challenge an intercepted code can be redeemed by whoever caught it.
  if (params.codeChallenge === null || params.codeChallenge.trim() === "") {
    return err("PKCE_REQUIRED");
  }
  if (params.codeChallengeMethod !== "S256") return err("PKCE_REQUIRED");

  // The audience is pinned: a token minted here is good for this MCP endpoint
  // and nothing else, so it cannot be replayed against another server that
  // trusts the same authorization server.
  if (params.resource !== null && !sameResource(params.resource, resource)) {
    return err("RESOURCE_MISMATCH");
  }

  const id = await oauth.createAuthorizationRequest({
    clientId: client.id,
    userId: user.id,
    redirectUri: params.redirectUri,
    scope: negotiateScope(params.scope),
    state: params.state,
    codeChallenge: params.codeChallenge,
    resource,
    expiresAt: secondsFromNow(AUTHORIZATION_REQUEST_TTL_SECONDS),
  });

  const created = await oauth.findAuthorizationRequest(id, user.id);
  if (created === null) return err("UNKNOWN_CLIENT");

  return ok(created);
}

export type ConsentFailure = "REQUEST_NOT_FOUND" | "REQUEST_EXPIRED";

export interface ConsentOutcome {
  /** Where to send the browser, with the code and the original state attached. */
  readonly redirectTo: string;
}

export async function approveAuthorization(
  requestId: string,
  user: AuthenticatedUser,
  { oauth, access, secrets }: OAuthDependencies,
): Promise<Result<ConsentOutcome, ConsentFailure>> {
  const request = await oauth.findAuthorizationRequest(requestId, user.id);
  if (request === null) return err("REQUEST_NOT_FOUND");

  if (isExpired(request.expiresAt)) {
    await oauth.deleteAuthorizationRequest(request.id);
    return err("REQUEST_EXPIRED");
  }

  const code = secrets.generate();

  await oauth.createAuthorizationCode({
    codeHash: secrets.hash(code),
    clientId: request.clientId,
    userId: user.id,
    redirectUri: request.redirectUri,
    scope: request.scope,
    codeChallenge: request.codeChallenge,
    resource: request.resource,
    expiresAt: secondsFromNow(AUTHORIZATION_CODE_TTL_SECONDS),
  });

  await oauth.deleteAuthorizationRequest(request.id);

  await access.recordAuditEvent({
    action: "MCP_ACCESS_GRANTED",
    actorKind: "SESSION",
    actorUserId: user.id,
    subject: request.clientId,
    metadata: { client: request.clientName, scope: request.scope },
  });

  const target = new URL(request.redirectUri);
  target.searchParams.set("code", code);
  if (request.state !== null) target.searchParams.set("state", request.state);

  return ok({ redirectTo: target.toString() });
}

export async function denyAuthorization(
  requestId: string,
  user: AuthenticatedUser,
  { oauth }: OAuthDependencies,
): Promise<Result<ConsentOutcome, ConsentFailure>> {
  const request = await oauth.findAuthorizationRequest(requestId, user.id);
  if (request === null) return err("REQUEST_NOT_FOUND");

  await oauth.deleteAuthorizationRequest(request.id);

  const target = new URL(request.redirectUri);
  target.searchParams.set("error", "access_denied");
  if (request.state !== null) target.searchParams.set("state", request.state);

  return ok({ redirectTo: target.toString() });
}

export interface TokenSet {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresInSeconds: number;
  readonly scope: string;
}

export type TokenFailure =
  | "INVALID_GRANT"
  | "INVALID_CLIENT"
  | "INVALID_REQUEST"
  | "UNSUPPORTED_GRANT_TYPE";

export interface AuthorizationCodeExchange {
  readonly code: string;
  readonly codeVerifier: string;
  readonly clientId: string;
  readonly redirectUri: string;
}

export async function exchangeAuthorizationCode(
  input: AuthorizationCodeExchange,
  dependencies: OAuthDependencies,
): Promise<Result<TokenSet, TokenFailure>> {
  const { oauth, secrets } = dependencies;

  if (input.code === "" || input.codeVerifier === "") return err("INVALID_REQUEST");

  const stored = await oauth.consumeAuthorizationCode(secrets.hash(input.code), new Date());
  if (stored === null) return err("INVALID_GRANT");

  // A code that outlived its minute, was issued to another client, or comes
  // back to a different redirect target is refused: each of those is a sign
  // the code did not travel the path it was minted for.
  if (isExpired(stored.expiresAt)) return err("INVALID_GRANT");
  if (stored.clientId !== input.clientId) return err("INVALID_CLIENT");
  if (stored.redirectUri !== input.redirectUri) return err("INVALID_GRANT");

  if (secrets.challengeFor(input.codeVerifier) !== stored.codeChallenge) {
    return err("INVALID_GRANT");
  }

  return ok(
    await issueTokens(
      {
        clientId: stored.clientId,
        userId: stored.userId,
        scope: stored.scope,
        resource: stored.resource,
      },
      dependencies,
    ),
  );
}

export async function refreshAccessToken(
  input: { readonly refreshToken: string; readonly clientId: string },
  dependencies: OAuthDependencies,
): Promise<Result<TokenSet, TokenFailure>> {
  const { oauth, secrets } = dependencies;

  const grant = await oauth.findTokenByHash(secrets.hash(input.refreshToken));
  if (grant === null || grant.kind !== "REFRESH") return err("INVALID_GRANT");
  if (!isUsable(grant)) return err("INVALID_GRANT");
  if (grant.clientId !== input.clientId) return err("INVALID_CLIENT");

  // Rotation: the whole grant is revoked and replaced, so a refresh token that
  // leaked stops working the moment the legitimate client uses its own.
  await oauth.revokeTokensForGrant(grant.clientId, grant.userId, new Date());

  return ok(
    await issueTokens(
      {
        clientId: grant.clientId,
        userId: grant.userId,
        scope: grant.scope,
        resource: grant.resource,
      },
      dependencies,
    ),
  );
}

/** Applications this person has approved and that still hold a live token. */
export function listAuthorizedClients(
  user: AuthenticatedUser,
  { oauth }: Pick<OAuthDependencies, "oauth">,
): Promise<readonly OAuthClient[]> {
  return oauth.listAuthorizedClients(user.id);
}

/**
 * Withdraws an approval.
 *
 * Every token of that client for that person is revoked at once, so the agent
 * stops working on the next call rather than whenever its access token
 * happened to expire.
 */
export async function revokeClientAccess(
  clientId: string,
  user: AuthenticatedUser,
  { oauth, access }: OAuthDependencies,
): Promise<void> {
  await oauth.revokeTokensForGrant(clientId, user.id, new Date());

  await access.recordAuditEvent({
    action: "MCP_ACCESS_REVOKED",
    actorKind: "SESSION",
    actorUserId: user.id,
    subject: clientId,
    metadata: null,
  });
}

export interface AuthenticatedGrant {
  readonly grant: TokenGrant;
  readonly user: AuthenticatedUser;
}

/**
 * Verifies a bearer access token presented to the MCP endpoint.
 *
 * The token is only good for the audience it was minted for and for a user who
 * is still active: disabling somebody in the team screen closes their agents
 * too, without anyone having to remember to revoke a token.
 */
export async function authenticateAccessToken(
  token: string,
  { oauth, access, secrets, resource }: OAuthDependencies,
): Promise<AuthenticatedGrant | null> {
  const grant = await oauth.findTokenByHash(secrets.hash(token));
  if (grant === null || grant.kind !== "ACCESS" || !isUsable(grant)) return null;
  if (grant.resource !== null && !sameResource(grant.resource, resource)) return null;

  const user = await access.findUserById(grant.userId);
  if (user === null || user.status !== "ACTIVE") return null;

  await oauth.touchToken(grant.id, new Date());

  return { grant, user };
}

async function issueTokens(
  input: {
    readonly clientId: string;
    readonly userId: string;
    readonly scope: string;
    readonly resource: string | null;
  },
  { oauth, secrets }: OAuthDependencies,
): Promise<TokenSet> {
  const accessToken = secrets.generate();
  const refreshToken = secrets.generate();

  await oauth.createToken({
    tokenHash: secrets.hash(accessToken),
    kind: "ACCESS",
    clientId: input.clientId,
    userId: input.userId,
    scope: input.scope,
    resource: input.resource,
    expiresAt: secondsFromNow(ACCESS_TOKEN_TTL_SECONDS),
  });

  await oauth.createToken({
    tokenHash: secrets.hash(refreshToken),
    kind: "REFRESH",
    clientId: input.clientId,
    userId: input.userId,
    scope: input.scope,
    resource: input.resource,
    expiresAt: secondsFromNow(REFRESH_TOKEN_TTL_SECONDS),
  });

  return {
    accessToken,
    refreshToken,
    expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
    scope: input.scope,
  };
}

/** Compares audiences ignoring a trailing slash, which clients add freely. */
function sameResource(left: string, right: string): boolean {
  const normalize = (value: string): string => value.replace(/\/+$/, "");
  return normalize(left) === normalize(right);
}

function secondsFromNow(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000);
}
