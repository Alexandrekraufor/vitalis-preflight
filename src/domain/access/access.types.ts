/**
 * Who may do what.
 *
 * This is a separate bounded context from guide validation on purpose: the rule
 * engine never learns that users exist, and nothing here knows what a finding
 * is. The two only meet in the route handlers and pages that guard access.
 */
export const USER_ROLES = ["ADMIN", "MEMBER", "EVALUATOR"] as const;

/**
 * Roles a person may be given from inside the application.
 *
 * `EVALUATOR` is deliberately absent: it exists for a reviewer who has to see
 * the product end to end during an assessment, and it is created only by the
 * provisioning script, never handed out from the team screen.
 */
export const ASSIGNABLE_ROLES = ["ADMIN", "MEMBER"] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "DISABLED"] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export const INVITATION_STATUSES = ["PENDING", "ACCEPTED", "REVOKED"] as const;

export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

const ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  ADMIN: "Administrador",
  MEMBER: "Operação",
  EVALUATOR: "Avaliação",
};

const USER_STATUS_LABELS: Readonly<Record<UserStatus, string>> = {
  ACTIVE: "Ativo",
  DISABLED: "Desativado",
};

const INVITATION_STATUS_LABELS: Readonly<Record<InvitationStatus, string>> = {
  PENDING: "Pendente",
  ACCEPTED: "Aceito",
  REVOKED: "Revogado",
};

export function userRoleLabel(role: UserRole): string {
  return ROLE_LABELS[role];
}

export function userStatusLabel(status: UserStatus): string {
  return USER_STATUS_LABELS[status];
}

export function invitationStatusLabel(status: InvitationStatus): string {
  return INVITATION_STATUS_LABELS[status];
}

/**
 * A signed-in person, as every guard hands them to the code it protects.
 * Deliberately does not carry the password hash - it has no reason to exist
 * outside the authentication adapter.
 */
export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: UserRole;
  readonly status: UserStatus;
}

export interface TeamMember extends AuthenticatedUser {
  readonly createdAt: Date;
  readonly lastLoginAt: Date | null;
}

export interface Invitation {
  readonly id: string;
  readonly email: string;
  readonly role: UserRole;
  readonly status: InvitationStatus;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly createdByName: string | null;
  readonly acceptedAt: Date | null;
  readonly revokedAt: Date | null;
}

/** Addresses are compared case-insensitively; this is the canonical form. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAdmin(user: AuthenticatedUser): boolean {
  return user.role === "ADMIN";
}
