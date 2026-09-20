import "server-only";

import { and, count, desc, eq, gt, isNotNull, isNull, lt } from "drizzle-orm";

import type {
  AccessRepository,
  ApiCredentialMatch,
  EvaluationCredential,
  UpsertEvaluationCredentialInput,
  CreateApiCredentialInput,
  CreateInvitationInput,
  CreateUserInput,
  SessionRecord,
  StoredInvitation,
  UserCredentials,
} from "@/application/ports/access-repository.port";
import type {
  AuthenticatedUser,
  Invitation,
  TeamMember,
  UserRole,
  UserStatus,
} from "@/domain/access/access.types";
import { normalizeEmail } from "@/domain/access/access.types";
import type { ApiCredential } from "@/domain/access/api-credential";
import type { AuditEntry, AuditRecord } from "@/domain/access/audit";

import type { Database } from "../client";
import { apiCredentials, auditEvents, invitations, sessions, users } from "../schema/access";

/**
 * Identity and access, backed by PostgreSQL.
 *
 * Reads never select `password_hash` unless the caller is the authentication
 * adapter asking for it by name, which keeps the digest from drifting into a
 * response payload by accident.
 */
export function createDrizzleAccessRepository(database: Database): AccessRepository {
  const publicUserColumns = {
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
    status: users.status,
  } as const;

  return {
    async findUserByEmail(email: string): Promise<UserCredentials | null> {
      const [row] = await database
        .select({ ...publicUserColumns, passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.email, normalizeEmail(email)))
        .limit(1);

      return row ?? null;
    },

    async findUserById(id: string): Promise<AuthenticatedUser | null> {
      const [row] = await database
        .select(publicUserColumns)
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      return row ?? null;
    },

    async createUser(input: CreateUserInput): Promise<AuthenticatedUser> {
      const [row] = await database
        .insert(users)
        .values({
          email: normalizeEmail(input.email),
          name: input.name,
          passwordHash: input.passwordHash,
          role: input.role,
        })
        .returning(publicUserColumns);

      if (row === undefined) throw new Error("Falha ao criar o usuário.");
      return row;
    },

    async listMembers(): Promise<readonly TeamMember[]> {
      return database
        .select({ ...publicUserColumns, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt })
        .from(users)
        .orderBy(users.name);
    },

    async setUserStatus(userId: string, status: UserStatus): Promise<void> {
      await database
        .update(users)
        .set({ status, updatedAt: new Date() })
        .where(eq(users.id, userId));
    },

    async setUserRole(userId: string, role: UserRole): Promise<void> {
      await database
        .update(users)
        .set({ role, updatedAt: new Date() })
        .where(eq(users.id, userId));
    },

    async recordLogin(userId: string, at: Date): Promise<void> {
      await database.update(users).set({ lastLoginAt: at }).where(eq(users.id, userId));
    },

    async countAdmins(): Promise<number> {
      const [row] = await database
        .select({ total: count() })
        .from(users)
        .where(and(eq(users.role, "ADMIN"), eq(users.status, "ACTIVE")));

      return row?.total ?? 0;
    },

    async createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
      await database.insert(sessions).values({ userId, tokenHash, expiresAt });
    },

    async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
      const [row] = await database
        .select({
          id: sessions.id,
          expiresAt: sessions.expiresAt,
          user: publicUserColumns,
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(
          and(
            eq(sessions.tokenHash, tokenHash),
            // Expiry and account status are enforced in the query, so a stale
            // cookie or a disabled member simply has no session to find.
            gt(sessions.expiresAt, new Date()),
            eq(users.status, "ACTIVE"),
          ),
        )
        .limit(1);

      return row ?? null;
    },

    async touchSession(sessionId: string, lastSeenAt: Date): Promise<void> {
      await database.update(sessions).set({ lastSeenAt }).where(eq(sessions.id, sessionId));
    },

    async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
      await database.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    },

    async deleteSessionsForUser(userId: string): Promise<void> {
      await database.delete(sessions).where(eq(sessions.userId, userId));
    },

    async deleteExpiredSessions(now: Date): Promise<void> {
      await database.delete(sessions).where(lt(sessions.expiresAt, now));
    },

    async createInvitation(input: CreateInvitationInput): Promise<string> {
      const [row] = await database
        .insert(invitations)
        .values({
          email: normalizeEmail(input.email),
          role: input.role,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          createdBy: input.createdBy,
        })
        .returning({ id: invitations.id });

      if (row === undefined) throw new Error("Falha ao criar o convite.");
      return row.id;
    },

    async findInvitationByTokenHash(tokenHash: string): Promise<StoredInvitation | null> {
      const [row] = await database
        .select({
          id: invitations.id,
          email: invitations.email,
          role: invitations.role,
          status: invitations.status,
          expiresAt: invitations.expiresAt,
        })
        .from(invitations)
        .where(eq(invitations.tokenHash, tokenHash))
        .limit(1);

      return row ?? null;
    },

    async findPendingInvitationForEmail(email: string): Promise<StoredInvitation | null> {
      const [row] = await database
        .select({
          id: invitations.id,
          email: invitations.email,
          role: invitations.role,
          status: invitations.status,
          expiresAt: invitations.expiresAt,
        })
        .from(invitations)
        .where(
          and(
            eq(invitations.email, normalizeEmail(email)),
            eq(invitations.status, "PENDING"),
          ),
        )
        .limit(1);

      return row ?? null;
    },

    async listInvitations(): Promise<readonly Invitation[]> {
      const rows = await database
        .select({
          id: invitations.id,
          email: invitations.email,
          role: invitations.role,
          status: invitations.status,
          expiresAt: invitations.expiresAt,
          createdAt: invitations.createdAt,
          acceptedAt: invitations.acceptedAt,
          revokedAt: invitations.revokedAt,
          createdByName: users.name,
        })
        .from(invitations)
        .leftJoin(users, eq(invitations.createdBy, users.id))
        .orderBy(desc(invitations.createdAt));

      return rows;
    },

    async markInvitationAccepted(id: string, at: Date): Promise<boolean> {
      // The `status = PENDING` predicate makes acceptance atomic: two requests
      // racing on the same token produce exactly one winner.
      const updated = await database
        .update(invitations)
        .set({ status: "ACCEPTED", acceptedAt: at })
        .where(and(eq(invitations.id, id), eq(invitations.status, "PENDING")))
        .returning({ id: invitations.id });

      return updated.length === 1;
    },

    async revokeInvitation(id: string, at: Date): Promise<boolean> {
      const updated = await database
        .update(invitations)
        .set({ status: "REVOKED", revokedAt: at })
        .where(and(eq(invitations.id, id), eq(invitations.status, "PENDING")))
        .returning({ id: invitations.id });

      return updated.length === 1;
    },

    async createApiCredential(input: CreateApiCredentialInput): Promise<string> {
      const [created] = await database
        .insert(apiCredentials)
        .values({
          name: input.name,
          surface: input.surface,
          scopes: [...input.scopes],
          tokenHash: input.tokenHash,
          hint: input.hint,
          createdBy: input.createdBy,
        })
        .returning({ id: apiCredentials.id });

      if (created === undefined) throw new Error("Falha ao criar a credencial.");
      return created.id;
    },

    async upsertEvaluationCredential(input: UpsertEvaluationCredentialInput): Promise<void> {
      await database.transaction(async (transaction) => {
        // One evaluation credential per surface: provisioning again rotates it
        // instead of piling up keys nobody tracks.
        await transaction
          .delete(apiCredentials)
          .where(
            and(
              eq(apiCredentials.surface, input.surface),
              isNotNull(apiCredentials.evaluationSecret),
            ),
          );

        await transaction.insert(apiCredentials).values({
          name: input.name,
          surface: input.surface,
          scopes: [...input.scopes],
          tokenHash: input.tokenHash,
          hint: input.hint,
          evaluationSecret: input.secret,
        });
      });
    },

    async listEvaluationCredentials(): Promise<readonly EvaluationCredential[]> {
      const rows = await database
        .select({
          id: apiCredentials.id,
          name: apiCredentials.name,
          surface: apiCredentials.surface,
          scopes: apiCredentials.scopes,
          secret: apiCredentials.evaluationSecret,
          revokedAt: apiCredentials.revokedAt,
        })
        .from(apiCredentials)
        .where(isNotNull(apiCredentials.evaluationSecret))
        .orderBy(apiCredentials.surface);

      return rows.flatMap((row) =>
        row.secret === null ? [] : [{ ...row, secret: row.secret }],
      );
    },

    async setUserPassword(userId: string, passwordHash: string): Promise<void> {
      await database
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, userId));
    },

    async listApiCredentials(): Promise<readonly ApiCredential[]> {
      const rows = await database
        .select({
          id: apiCredentials.id,
          name: apiCredentials.name,
          surface: apiCredentials.surface,
          scopes: apiCredentials.scopes,
          hint: apiCredentials.hint,
          createdAt: apiCredentials.createdAt,
          createdByName: users.name,
          lastUsedAt: apiCredentials.lastUsedAt,
          revokedAt: apiCredentials.revokedAt,
        })
        .from(apiCredentials)
        .leftJoin(users, eq(apiCredentials.createdBy, users.id))
        .orderBy(desc(apiCredentials.createdAt));

      return rows;
    },

    async findApiCredentialByTokenHash(tokenHash: string): Promise<ApiCredentialMatch | null> {
      const [row] = await database
        .select({
          id: apiCredentials.id,
          surface: apiCredentials.surface,
          scopes: apiCredentials.scopes,
          revokedAt: apiCredentials.revokedAt,
        })
        .from(apiCredentials)
        .where(eq(apiCredentials.tokenHash, tokenHash))
        .limit(1);

      return row ?? null;
    },

    async touchApiCredential(id: string, at: Date): Promise<void> {
      await database
        .update(apiCredentials)
        .set({ lastUsedAt: at })
        .where(eq(apiCredentials.id, id));
    },

    async revokeApiCredential(id: string, at: Date): Promise<boolean> {
      const updated = await database
        .update(apiCredentials)
        .set({ revokedAt: at })
        .where(and(eq(apiCredentials.id, id), isNull(apiCredentials.revokedAt)))
        .returning({ id: apiCredentials.id });

      return updated.length === 1;
    },

    async recordAuditEvent(entry: AuditEntry): Promise<void> {
      await database.insert(auditEvents).values({
        action: entry.action,
        actorKind: entry.actorKind,
        actorUserId: entry.actorUserId,
        subject: entry.subject,
        metadata: entry.metadata,
      });
    },

    async listAuditEvents(limit: number): Promise<readonly AuditRecord[]> {
      const rows = await database
        .select({
          id: auditEvents.id,
          action: auditEvents.action,
          actorKind: auditEvents.actorKind,
          actorUserId: auditEvents.actorUserId,
          subject: auditEvents.subject,
          metadata: auditEvents.metadata,
          createdAt: auditEvents.createdAt,
          actorName: users.name,
        })
        .from(auditEvents)
        .leftJoin(users, eq(auditEvents.actorUserId, users.id))
        .orderBy(desc(auditEvents.createdAt))
        .limit(limit);

      return rows.map((row) => ({
        ...row,
        actorKind: row.actorKind as AuditRecord["actorKind"],
        metadata: row.metadata,
      }));
    },
  };
}
