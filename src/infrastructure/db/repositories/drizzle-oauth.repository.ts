import "server-only";

import { and, eq, isNull, lt, sql } from "drizzle-orm";

import type {
  CreateAuthorizationCodeInput,
  CreateAuthorizationRequestInput,
  CreateTokenInput,
  OAuthRepository,
  RegisterClientInput,
  StoredAuthorizationCode,
} from "@/application/ports/oauth-repository.port";
import type {
  AuthorizationRequest,
  OAuthClient,
  TokenGrant,
} from "@/domain/access/oauth";

import type { Database } from "../client";
import {
  oauthAuthorizationCodes,
  oauthAuthorizationRequests,
  oauthClients,
  oauthTokens,
} from "../schema/oauth";

export function createDrizzleOAuthRepository(database: Database): OAuthRepository {
  return {
    async registerClient(input: RegisterClientInput): Promise<OAuthClient> {
      const [created] = await database
        .insert(oauthClients)
        .values({ name: input.name, redirectUris: [...input.redirectUris] })
        .returning();

      if (created === undefined) throw new Error("Falha ao registrar o cliente.");

      return {
        id: created.id,
        name: created.name,
        redirectUris: created.redirectUris,
        createdAt: created.createdAt,
      };
    },

    async findClient(clientId: string): Promise<OAuthClient | null> {
      const [row] = await database
        .select()
        .from(oauthClients)
        .where(eq(oauthClients.id, clientId))
        .limit(1);

      return row === undefined
        ? null
        : {
            id: row.id,
            name: row.name,
            redirectUris: row.redirectUris,
            createdAt: row.createdAt,
          };
    },

    async createAuthorizationRequest(
      input: CreateAuthorizationRequestInput,
    ): Promise<string> {
      const [created] = await database
        .insert(oauthAuthorizationRequests)
        .values({
          clientId: input.clientId,
          userId: input.userId,
          redirectUri: input.redirectUri,
          scope: input.scope,
          state: input.state,
          codeChallenge: input.codeChallenge,
          resource: input.resource,
          expiresAt: input.expiresAt,
        })
        .returning({ id: oauthAuthorizationRequests.id });

      if (created === undefined) throw new Error("Falha ao registrar o pedido.");
      return created.id;
    },

    async findAuthorizationRequest(
      id: string,
      userId: string,
    ): Promise<AuthorizationRequest | null> {
      const [row] = await database
        .select({
          request: oauthAuthorizationRequests,
          clientName: oauthClients.name,
        })
        .from(oauthAuthorizationRequests)
        .innerJoin(oauthClients, eq(oauthAuthorizationRequests.clientId, oauthClients.id))
        .where(
          and(
            eq(oauthAuthorizationRequests.id, id),
            eq(oauthAuthorizationRequests.userId, userId),
          ),
        )
        .limit(1);

      if (row === undefined) return null;

      return {
        id: row.request.id,
        clientId: row.request.clientId,
        clientName: row.clientName,
        userId: row.request.userId,
        redirectUri: row.request.redirectUri,
        scope: row.request.scope,
        state: row.request.state,
        codeChallenge: row.request.codeChallenge,
        resource: row.request.resource,
        expiresAt: row.request.expiresAt,
      };
    },

    async deleteAuthorizationRequest(id: string): Promise<void> {
      await database
        .delete(oauthAuthorizationRequests)
        .where(eq(oauthAuthorizationRequests.id, id));
    },

    async createAuthorizationCode(input: CreateAuthorizationCodeInput): Promise<void> {
      await database.insert(oauthAuthorizationCodes).values({
        codeHash: input.codeHash,
        clientId: input.clientId,
        userId: input.userId,
        redirectUri: input.redirectUri,
        scope: input.scope,
        codeChallenge: input.codeChallenge,
        resource: input.resource,
        expiresAt: input.expiresAt,
      });
    },

    async consumeAuthorizationCode(
      codeHash: string,
      at: Date,
    ): Promise<StoredAuthorizationCode | null> {
      // The `consumed_at is null` predicate is the single-use guarantee: two
      // simultaneous redemptions of the same code produce exactly one winner.
      const [row] = await database
        .update(oauthAuthorizationCodes)
        .set({ consumedAt: at })
        .where(
          and(
            eq(oauthAuthorizationCodes.codeHash, codeHash),
            isNull(oauthAuthorizationCodes.consumedAt),
          ),
        )
        .returning();

      return row === undefined
        ? null
        : {
            clientId: row.clientId,
            userId: row.userId,
            redirectUri: row.redirectUri,
            scope: row.scope,
            codeChallenge: row.codeChallenge,
            resource: row.resource,
            expiresAt: row.expiresAt,
          };
    },

    async createToken(input: CreateTokenInput): Promise<string> {
      const [created] = await database
        .insert(oauthTokens)
        .values({
          tokenHash: input.tokenHash,
          kind: input.kind,
          clientId: input.clientId,
          userId: input.userId,
          scope: input.scope,
          resource: input.resource,
          expiresAt: input.expiresAt,
        })
        .returning({ id: oauthTokens.id });

      if (created === undefined) throw new Error("Falha ao emitir o token.");
      return created.id;
    },

    async findTokenByHash(tokenHash: string): Promise<TokenGrant | null> {
      const [row] = await database
        .select()
        .from(oauthTokens)
        .where(eq(oauthTokens.tokenHash, tokenHash))
        .limit(1);

      return row === undefined
        ? null
        : {
            id: row.id,
            kind: row.kind,
            clientId: row.clientId,
            userId: row.userId,
            scope: row.scope,
            resource: row.resource,
            expiresAt: row.expiresAt,
            revokedAt: row.revokedAt,
          };
    },

    async touchToken(id: string, at: Date): Promise<void> {
      await database.update(oauthTokens).set({ lastUsedAt: at }).where(eq(oauthTokens.id, id));
    },

    async revokeToken(id: string, at: Date): Promise<void> {
      await database
        .update(oauthTokens)
        .set({ revokedAt: at })
        .where(and(eq(oauthTokens.id, id), isNull(oauthTokens.revokedAt)));
    },

    async revokeTokensForGrant(clientId: string, userId: string, at: Date): Promise<void> {
      await database
        .update(oauthTokens)
        .set({ revokedAt: at })
        .where(
          and(
            eq(oauthTokens.clientId, clientId),
            eq(oauthTokens.userId, userId),
            isNull(oauthTokens.revokedAt),
          ),
        );
    },

    async listAuthorizedClients(userId: string): Promise<readonly OAuthClient[]> {
      const rows = await database
        .selectDistinctOn([oauthClients.id], {
          id: oauthClients.id,
          name: oauthClients.name,
          redirectUris: oauthClients.redirectUris,
          createdAt: oauthClients.createdAt,
        })
        .from(oauthTokens)
        .innerJoin(oauthClients, eq(oauthTokens.clientId, oauthClients.id))
        .where(
          and(
            eq(oauthTokens.userId, userId),
            isNull(oauthTokens.revokedAt),
            sql`${oauthTokens.expiresAt} > now()`,
          ),
        );

      return rows;
    },

    async deleteExpired(now: Date): Promise<void> {
      await Promise.all([
        database
          .delete(oauthAuthorizationRequests)
          .where(lt(oauthAuthorizationRequests.expiresAt, now)),
        database
          .delete(oauthAuthorizationCodes)
          .where(lt(oauthAuthorizationCodes.expiresAt, now)),
      ]);
    },
  };
}
