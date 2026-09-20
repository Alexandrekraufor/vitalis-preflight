import type {
  AuthenticatedUser,
  Invitation,
  InvitationStatus,
  TeamMember,
  UserRole,
  UserStatus,
} from "@/domain/access/access.types";
import type { AuditEntry, AuditRecord } from "@/domain/access/audit";

/** A user as the authentication adapter needs them — with the digest attached. */
export interface UserCredentials extends AuthenticatedUser {
  readonly passwordHash: string;
}

export interface CreateUserInput {
  readonly email: string;
  readonly name: string;
  readonly passwordHash: string;
  readonly role: UserRole;
}

export interface CreateInvitationInput {
  readonly email: string;
  readonly role: UserRole;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly createdBy: string;
}

export interface StoredInvitation {
  readonly id: string;
  readonly email: string;
  readonly role: UserRole;
  readonly status: InvitationStatus;
  readonly expiresAt: Date;
}

export interface SessionRecord {
  readonly id: string;
  readonly user: AuthenticatedUser;
  readonly expiresAt: Date;
}

/**
 * Persistence boundary for identity and access.
 *
 * Kept apart from `GuideRepository` because they are different aggregates with
 * different lifecycles — and because it makes it obvious, in a diff, when a
 * piece of guide code starts reaching for user data.
 */
export interface AccessRepository {
  findUserByEmail(email: string): Promise<UserCredentials | null>;
  findUserById(id: string): Promise<AuthenticatedUser | null>;
  createUser(input: CreateUserInput): Promise<AuthenticatedUser>;
  listMembers(): Promise<readonly TeamMember[]>;
  setUserStatus(userId: string, status: UserStatus): Promise<void>;
  setUserRole(userId: string, role: UserRole): Promise<void>;
  recordLogin(userId: string, at: Date): Promise<void>;
  countAdmins(): Promise<number>;

  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  /** Returns the session only when it exists, has not expired and the user is active. */
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  touchSession(sessionId: string, lastSeenAt: Date): Promise<void>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  /** Used when a member is disabled or their role changes: every device is signed out. */
  deleteSessionsForUser(userId: string): Promise<void>;
  deleteExpiredSessions(now: Date): Promise<void>;

  createInvitation(input: CreateInvitationInput): Promise<string>;
  findInvitationByTokenHash(tokenHash: string): Promise<StoredInvitation | null>;
  findPendingInvitationForEmail(email: string): Promise<StoredInvitation | null>;
  listInvitations(): Promise<readonly Invitation[]>;
  markInvitationAccepted(id: string, at: Date): Promise<boolean>;
  revokeInvitation(id: string, at: Date): Promise<boolean>;

  recordAuditEvent(entry: AuditEntry): Promise<void>;
  listAuditEvents(limit: number): Promise<readonly AuditRecord[]>;
}
