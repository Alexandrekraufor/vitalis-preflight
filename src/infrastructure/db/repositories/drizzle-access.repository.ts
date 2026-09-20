import "server-only";

import { and, count, desc, eq, gt, lt } from "drizzle-orm";

import type {
  AccessRepository,
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
import type { AuditEntry, AuditRecord } from "@/domain/access/audit";

import type { Database } from "../client";
import { auditEvents, invitations, sessions, users } from "../schema/access";

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
