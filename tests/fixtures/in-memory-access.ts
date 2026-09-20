import { randomUUID } from "node:crypto";

import type {
  AccessRepository,
  CreateInvitationInput,
  CreateUserInput,
  SessionRecord,
  StoredInvitation,
  UserCredentials,
} from "@/application/ports/access-repository.port";
import type {
  InvitationMailer,
  InvitationMessage,
} from "@/application/ports/invitation-mailer.port";
import type {
  AuthenticatedUser,
  Invitation,
  InvitationStatus,
  TeamMember,
  UserRole,
  UserStatus,
} from "@/domain/access/access.types";
import { normalizeEmail } from "@/domain/access/access.types";
import type { AuditEntry, AuditRecord } from "@/domain/access/audit";

/** Mutable mirror of `UserCredentials`, which the port exposes as readonly. */
interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
}

interface StoredSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

interface StoredInvitationRow extends StoredInvitation {
  tokenHash: string;
  createdAt: Date;
  createdBy: string;
  acceptedAt: Date | null;
  revokedAt: Date | null;
}

/**
 * In-memory access store.
 *
 * It reproduces the two behaviours the security tests actually depend on: a
 * session lookup that filters expired sessions and disabled users, and an
 * invitation claim that only succeeds once.
 */
export function createInMemoryAccessRepository(): AccessRepository {
  const users = new Map<string, StoredUser>();
  const sessions = new Map<string, StoredSession>();
  const invitations = new Map<string, StoredInvitationRow>();
  const audit: AuditRecord[] = [];

  function publicUser(user: StoredUser): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    };
  }

  return {
    findUserByEmail(email: string): Promise<UserCredentials | null> {
      const needle = normalizeEmail(email);
      const found = [...users.values()].find((user) => user.email === needle);
      return Promise.resolve(found ?? null);
    },

    findUserById(id: string): Promise<AuthenticatedUser | null> {
      const user = users.get(id);
      return Promise.resolve(user === undefined ? null : publicUser(user));
    },

    createUser(input: CreateUserInput): Promise<AuthenticatedUser> {
      const email = normalizeEmail(input.email);
      if ([...users.values()].some((user) => user.email === email)) {
        return Promise.reject(new Error("duplicate email"));
      }

      const user: StoredUser = {
        id: randomUUID(),
        email,
        name: input.name,
        passwordHash: input.passwordHash,
        role: input.role,
        status: "ACTIVE",
        createdAt: new Date(),
        lastLoginAt: null,
      };
      users.set(user.id, user);
      return Promise.resolve(publicUser(user));
    },

    listMembers(): Promise<readonly TeamMember[]> {
      return Promise.resolve(
        [...users.values()]
          .toSorted((left, right) => left.name.localeCompare(right.name))
          .map((user) => ({
            ...publicUser(user),
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt,
          })),
      );
    },

    setUserStatus(userId: string, status: UserStatus): Promise<void> {
      const user = users.get(userId);
      if (user !== undefined) user.status = status;
      return Promise.resolve();
    },

    setUserRole(userId: string, role: UserRole): Promise<void> {
      const user = users.get(userId);
      if (user !== undefined) user.role = role;
      return Promise.resolve();
    },

    recordLogin(userId: string, at: Date): Promise<void> {
      const user = users.get(userId);
      if (user !== undefined) user.lastLoginAt = at;
      return Promise.resolve();
    },

    countAdmins(): Promise<number> {
      return Promise.resolve(
        [...users.values()].filter(
          (user) => user.role === "ADMIN" && user.status === "ACTIVE",
        ).length,
      );
    },

    createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
      sessions.set(tokenHash, { id: randomUUID(), userId, tokenHash, expiresAt });
      return Promise.resolve();
    },

    findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
      const session = sessions.get(tokenHash);
      if (session === undefined) return Promise.resolve(null);
      if (session.expiresAt.getTime() <= Date.now()) return Promise.resolve(null);

      const user = users.get(session.userId);
      if (user === undefined || user.status !== "ACTIVE") return Promise.resolve(null);

      return Promise.resolve({
        id: session.id,
        user: publicUser(user),
        expiresAt: session.expiresAt,
      });
    },

    touchSession(): Promise<void> {
      return Promise.resolve();
    },

    deleteSessionByTokenHash(tokenHash: string): Promise<void> {
      sessions.delete(tokenHash);
      return Promise.resolve();
    },

    deleteSessionsForUser(userId: string): Promise<void> {
      for (const [key, session] of sessions) {
        if (session.userId === userId) sessions.delete(key);
      }
      return Promise.resolve();
    },

    deleteExpiredSessions(now: Date): Promise<void> {
      for (const [key, session] of sessions) {
        if (session.expiresAt.getTime() <= now.getTime()) sessions.delete(key);
      }
      return Promise.resolve();
    },

    createInvitation(input: CreateInvitationInput): Promise<string> {
      const id = randomUUID();
      invitations.set(id, {
        id,
        email: normalizeEmail(input.email),
        role: input.role,
        status: "PENDING",
        expiresAt: input.expiresAt,
        tokenHash: input.tokenHash,
        createdAt: new Date(),
        createdBy: input.createdBy,
        acceptedAt: null,
        revokedAt: null,
      });
      return Promise.resolve(id);
    },

    findInvitationByTokenHash(tokenHash: string): Promise<StoredInvitation | null> {
      const found = [...invitations.values()].find((row) => row.tokenHash === tokenHash);
      return Promise.resolve(found ?? null);
    },

    findPendingInvitationForEmail(email: string): Promise<StoredInvitation | null> {
      const needle = normalizeEmail(email);
      const found = [...invitations.values()].find(
        (row) => row.email === needle && row.status === "PENDING",
      );
      return Promise.resolve(found ?? null);
    },

    listInvitations(): Promise<readonly Invitation[]> {
      return Promise.resolve(
        [...invitations.values()]
          .toSorted((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
          .map((row) => ({
            id: row.id,
            email: row.email,
            role: row.role,
            status: row.status,
            expiresAt: row.expiresAt,
            createdAt: row.createdAt,
            createdByName: users.get(row.createdBy)?.name ?? null,
            acceptedAt: row.acceptedAt,
            revokedAt: row.revokedAt,
          })),
      );
    },

    markInvitationAccepted(id: string, at: Date): Promise<boolean> {
      return Promise.resolve(transition(invitations, id, "ACCEPTED", at));
    },

    revokeInvitation(id: string, at: Date): Promise<boolean> {
      return Promise.resolve(transition(invitations, id, "REVOKED", at));
    },

    recordAuditEvent(entry: AuditEntry): Promise<void> {
      audit.unshift({ ...entry, id: randomUUID(), actorName: null, createdAt: new Date() });
      return Promise.resolve();
    },

    listAuditEvents(limit: number): Promise<readonly AuditRecord[]> {
      return Promise.resolve(audit.slice(0, limit));
    },
  };
}

/** Only a PENDING invitation may change state, exactly like the SQL predicate. */
function transition(
  invitations: Map<string, StoredInvitationRow>,
  id: string,
  status: Extract<InvitationStatus, "ACCEPTED" | "REVOKED">,
  at: Date,
): boolean {
  const row = invitations.get(id);
  if (row === undefined || row.status !== "PENDING") return false;

  invitations.set(id, {
    ...row,
    status,
    ...(status === "ACCEPTED" ? { acceptedAt: at } : { revokedAt: at }),
  });
  return true;
}

export interface RecordingMailer extends InvitationMailer {
  readonly sent: readonly InvitationMessage[];
}

/** Captures the invitation link so tests can redeem it without parsing a log. */
export function createRecordingMailer(): RecordingMailer {
  const sent: InvitationMessage[] = [];

  return {
    name: "recording",
    sent,
    send(message: InvitationMessage): Promise<void> {
      sent.push(message);
      return Promise.resolve();
    },
  };
}
