import type {
  AuthorizationRequest,
  OAuthClient,
  TokenGrant,
  TokenKind,
} from "@/domain/access/oauth";

export interface RegisterClientInput {
  readonly name: string;
  readonly redirectUris: readonly string[];
}

export interface CreateAuthorizationRequestInput {
  readonly clientId: string;
  readonly userId: string;
  readonly redirectUri: string;
  readonly scope: string;
  readonly state: string | null;
  readonly codeChallenge: string;
  readonly resource: string | null;
  readonly expiresAt: Date;
}

export interface CreateAuthorizationCodeInput {
  readonly codeHash: string;
  readonly clientId: string;
  readonly userId: string;
  readonly redirectUri: string;
  readonly scope: string;
  readonly codeChallenge: string;
  readonly resource: string | null;
  readonly expiresAt: Date;
}

/** The code as the token endpoint reads it back, after consuming it. */
export interface StoredAuthorizationCode {
  readonly clientId: string;
  readonly userId: string;
  readonly redirectUri: string;
  readonly scope: string;
  readonly codeChallenge: string;
  readonly resource: string | null;
  readonly expiresAt: Date;
}

export interface CreateTokenInput {
  readonly tokenHash: string;
  readonly kind: TokenKind;
  readonly clientId: string;
  readonly userId: string;
  readonly scope: string;
  readonly resource: string | null;
  readonly expiresAt: Date;
}

/**
 * Persistence for the OAuth authorization server.
 *
 * Secrets cross this boundary only as digests: the repository never receives
 * an authorization code or a token in the clear, which keeps the one place
 * that could log them from ever seeing them.
 */
export interface OAuthRepository {
  registerClient(input: RegisterClientInput): Promise<OAuthClient>;
  findClient(clientId: string): Promise<OAuthClient | null>;

  createAuthorizationRequest(input: CreateAuthorizationRequestInput): Promise<string>;
  /** Scoped to the user on purpose: a pending consent belongs to whoever opened it. */
  findAuthorizationRequest(id: string, userId: string): Promise<AuthorizationRequest | null>;
  deleteAuthorizationRequest(id: string): Promise<void>;

  createAuthorizationCode(input: CreateAuthorizationCodeInput): Promise<void>;
  /** Single use: returns the code only on the redemption that wins the race. */
  consumeAuthorizationCode(codeHash: string, at: Date): Promise<StoredAuthorizationCode | null>;

  createToken(input: CreateTokenInput): Promise<string>;
  findTokenByHash(tokenHash: string): Promise<TokenGrant | null>;
  touchToken(id: string, at: Date): Promise<void>;
  revokeToken(id: string, at: Date): Promise<void>;
  /** Used when a refresh token is rotated, and when access is withdrawn. */
  revokeTokensForGrant(clientId: string, userId: string, at: Date): Promise<void>;

  listAuthorizedClients(userId: string): Promise<readonly OAuthClient[]>;
  deleteExpired(now: Date): Promise<void>;
}
