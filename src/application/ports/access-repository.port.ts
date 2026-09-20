import type {
  AuthenticatedUser,
  Invitation,
  InvitationStatus,
  TeamMember,
  UserRole,
  UserStatus,
} from "@/domain/access/access.types";
import type { ApiCredential, ApiScope, ApiSurface } from "@/domain/access/api-credential";
import type { AuditEntry, AuditRecord } from "@/domain/access/audit";

/** A user as the authentication adapter needs them - with the digest attached. */
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

export interface CreateApiCredentialInput {
  readonly name: string;
  readonly surface: ApiSurface;
  readonly scopes: readonly ApiScope[];
  readonly tokenHash: string;
  readonly hint: string;
  readonly createdBy: string;
}

/**
 * The one credential the evaluation user may read in full.
 *
 * It is separated from `ApiCredential` on purpose: the secret never travels
 * with the ordinary listing, only through this call.
 */
export interface EvaluationCredential {
  readonly id: string;
  readonly name: string;
  readonly surface: ApiSurface;
  readonly scopes: readonly ApiScope[];
  readonly secret: string;
  readonly revokedAt: Date | null;
}

export interface UpsertEvaluationCredentialInput {
  readonly name: string;
  readonly surface: ApiSurface;
  readonly scopes: readonly ApiScope[];
  readonly tokenHash: string;
  readonly hint: string;
  readonly secret: string;
}

/** What the authentication path needs: which surface, and whether it still counts. */
export interface ApiCredentialMatch {
  readonly id: string;
  readonly surface: ApiSurface;
  readonly scopes: readonly ApiScope[];
  readonly revokedAt: Date | null;
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
 * different lifecycles - and because it makes it obvious, in a diff, when a
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
  setUserPassword(userId: string, passwordHash: string): Promise<void>;
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

  createApiCredential(input: CreateApiCredentialInput): Promise<string>;
  /** Replaces the evaluation credential for a surface, or creates it. */
  upsertEvaluationCredential(input: UpsertEvaluationCredentialInput): Promise<void>;
  listEvaluationCredentials(): Promise<readonly EvaluationCredential[]>;
  listApiCredentials(): Promise<readonly ApiCredential[]>;
  /** Digest lookup: the secret itself never reaches the repository. */
  findApiCredentialByTokenHash(tokenHash: string): Promise<ApiCredentialMatch | null>;
  touchApiCredential(id: string, at: Date): Promise<void>;
  revokeApiCredential(id: string, at: Date): Promise<boolean>;

  recordAuditEvent(entry: AuditEntry): Promise<void>;
  listAuditEvents(limit: number): Promise<readonly AuditRecord[]>;
}
