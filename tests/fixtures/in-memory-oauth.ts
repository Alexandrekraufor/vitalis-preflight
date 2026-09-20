import { randomUUID } from "node:crypto";

import type {
  CreateAuthorizationCodeInput,
  CreateAuthorizationRequestInput,
  CreateTokenInput,
  OAuthRepository,
  RegisterClientInput,
  StoredAuthorizationCode,
} from "@/application/ports/oauth-repository.port";
import type { AuthorizationRequest, OAuthClient, TokenGrant } from "@/domain/access/oauth";

interface StoredCode extends StoredAuthorizationCode {
  readonly codeHash: string;
  consumedAt: Date | null;
}

interface StoredToken extends TokenGrant {
  readonly tokenHash: string;
  lastUsedAt: Date | null;
}

/**
 * The authorization server's storage, in memory.
 *
 * It keeps the same guarantees the SQL version does - single-use codes, hashed
 * secrets, consent scoped to its own user - so a test that passes here is
 * testing the real rules and not a laxer stand-in.
 */
export function createInMemoryOAuthRepository(): OAuthRepository {
  const clients = new Map<string, OAuthClient>();
  const requests = new Map<string, AuthorizationRequest>();
  const codes: StoredCode[] = [];
  const tokens: StoredToken[] = [];

  return {
    registerClient(input: RegisterClientInput): Promise<OAuthClient> {
      const client: OAuthClient = {
        id: randomUUID(),
        name: input.name,
        redirectUris: [...input.redirectUris],
        createdAt: new Date(),
      };
      clients.set(client.id, client);
      return Promise.resolve(client);
    },

    findClient(clientId: string): Promise<OAuthClient | null> {
      return Promise.resolve(clients.get(clientId) ?? null);
    },

    createAuthorizationRequest(input: CreateAuthorizationRequestInput): Promise<string> {
      const id = randomUUID();
      requests.set(id, {
        id,
        clientId: input.clientId,
        clientName: clients.get(input.clientId)?.name ?? "cliente",
        userId: input.userId,
        redirectUri: input.redirectUri,
        scope: input.scope,
        state: input.state,
        codeChallenge: input.codeChallenge,
        resource: input.resource,
        expiresAt: input.expiresAt,
      });
      return Promise.resolve(id);
    },

    findAuthorizationRequest(id: string, userId: string): Promise<AuthorizationRequest | null> {
      const request = requests.get(id);
      return Promise.resolve(
        request === undefined || request.userId !== userId ? null : request,
      );
    },

    deleteAuthorizationRequest(id: string): Promise<void> {
      requests.delete(id);
      return Promise.resolve();
    },

    createAuthorizationCode(input: CreateAuthorizationCodeInput): Promise<void> {
      codes.push({
        codeHash: input.codeHash,
        clientId: input.clientId,
        userId: input.userId,
        redirectUri: input.redirectUri,
        scope: input.scope,
        codeChallenge: input.codeChallenge,
        resource: input.resource,
        expiresAt: input.expiresAt,
        consumedAt: null,
      });
      return Promise.resolve();
    },

    consumeAuthorizationCode(
      codeHash: string,
      at: Date,
    ): Promise<StoredAuthorizationCode | null> {
      const found = codes.find(
        (code) => code.codeHash === codeHash && code.consumedAt === null,
      );
      if (found === undefined) return Promise.resolve(null);

      found.consumedAt = at;
      return Promise.resolve(found);
    },

    createToken(input: CreateTokenInput): Promise<string> {
      const id = randomUUID();
      tokens.push({
        id,
        tokenHash: input.tokenHash,
        kind: input.kind,
        clientId: input.clientId,
        userId: input.userId,
        scope: input.scope,
        resource: input.resource,
        expiresAt: input.expiresAt,
        revokedAt: null,
        lastUsedAt: null,
      });
      return Promise.resolve(id);
    },

    findTokenByHash(tokenHash: string): Promise<TokenGrant | null> {
      return Promise.resolve(tokens.find((token) => token.tokenHash === tokenHash) ?? null);
    },

    touchToken(id: string, at: Date): Promise<void> {
      const found = tokens.find((token) => token.id === id);
      if (found !== undefined) found.lastUsedAt = at;
      return Promise.resolve();
    },

    revokeToken(id: string, at: Date): Promise<void> {
      const found = tokens.find((token) => token.id === id);
      if (found !== undefined && found.revokedAt === null) {
        Object.assign(found, { revokedAt: at });
      }
      return Promise.resolve();
    },

    revokeTokensForGrant(clientId: string, userId: string, at: Date): Promise<void> {
      for (const token of tokens) {
        if (token.clientId === clientId && token.userId === userId && token.revokedAt === null) {
          Object.assign(token, { revokedAt: at });
        }
      }
      return Promise.resolve();
    },

    listAuthorizedClients(userId: string): Promise<readonly OAuthClient[]> {
      const now = Date.now();
      const active = new Set(
        tokens
          .filter(
            (token) =>
              token.userId === userId &&
              token.revokedAt === null &&
              token.expiresAt.getTime() > now,
          )
          .map((token) => token.clientId),
      );

      return Promise.resolve(
        [...active].flatMap((clientId) => {
          const client = clients.get(clientId);
          return client === undefined ? [] : [client];
        }),
      );
    },

    deleteExpired(now: Date): Promise<void> {
      for (const [id, request] of requests) {
        if (request.expiresAt <= now) requests.delete(id);
      }
      return Promise.resolve();
    },
  };
}
