import type { AccessRepository } from "@/application/ports/access-repository.port";
import type {
  AuthenticatedUser,
  Invitation,
  TeamMember,
  UserRole,
} from "@/domain/access/access.types";
import { err, ok, type Result } from "@/lib/result";

export interface TeamOverview {
  readonly members: readonly TeamMember[];
  readonly invitations: readonly Invitation[];
}

export function getTeamOverview(access: AccessRepository): Promise<TeamOverview> {
  return Promise.all([access.listMembers(), access.listInvitations()]).then(
    ([members, invitations]) => ({ members, invitations }),
  );
}

export type TeamChangeFailure =
  | "MEMBER_NOT_FOUND"
  | "CANNOT_CHANGE_SELF"
  | "LAST_ADMIN";

/**
 * Guard shared by every destructive change to a member.
 *
 * Two invariants: an administrator cannot lock themselves out by editing their
 * own row, and the last active administrator cannot be removed or demoted -
 * otherwise the team would need a database console to recover.
 */
async function assertChangeAllowed(
  access: AccessRepository,
  actor: AuthenticatedUser,
  targetId: string,
  removesAnAdmin: boolean,
): Promise<TeamChangeFailure | null> {
  if (actor.id === targetId) return "CANNOT_CHANGE_SELF";

  const target = await access.findUserById(targetId);
  if (target === null) return "MEMBER_NOT_FOUND";

  if (removesAnAdmin && target.role === "ADMIN" && target.status === "ACTIVE") {
    const admins = await access.countAdmins();
    if (admins <= 1) return "LAST_ADMIN";
  }

  return null;
}

export async function setMemberStatus(
  input: { readonly targetId: string; readonly disable: boolean },
  actor: AuthenticatedUser,
  access: AccessRepository,
): Promise<Result<void, TeamChangeFailure>> {
  const failure = await assertChangeAllowed(access, actor, input.targetId, input.disable);
  if (failure !== null) return err(failure);

  await access.setUserStatus(input.targetId, input.disable ? "DISABLED" : "ACTIVE");

  if (input.disable) {
    // A disabled member must lose access immediately, not when their cookie
    // happens to expire.
    await access.deleteSessionsForUser(input.targetId);
  }

  await access.recordAuditEvent({
    action: input.disable ? "USER_DISABLED" : "USER_REACTIVATED",
    actorKind: "SESSION",
    actorUserId: actor.id,
    subject: input.targetId,
    metadata: null,
  });

  return ok(undefined);
}

export async function setMemberRole(
  input: { readonly targetId: string; readonly role: UserRole },
  actor: AuthenticatedUser,
  access: AccessRepository,
): Promise<Result<void, TeamChangeFailure>> {
  const failure = await assertChangeAllowed(
    access,
    actor,
    input.targetId,
    input.role !== "ADMIN",
  );
  if (failure !== null) return err(failure);

  await access.setUserRole(input.targetId, input.role);
  // Sessions carry no role of their own, but signing the member out forces the
  // new permissions to be picked up on the next request without ambiguity.
  await access.deleteSessionsForUser(input.targetId);

  await access.recordAuditEvent({
    action: "USER_ROLE_CHANGED",
    actorKind: "SESSION",
    actorUserId: actor.id,
    subject: input.targetId,
    metadata: { role: input.role },
  });

  return ok(undefined);
}

export async function revokeInvitation(
  invitationId: string,
  actor: AuthenticatedUser,
  access: AccessRepository,
): Promise<Result<void, "INVITATION_NOT_PENDING">> {
  const revoked = await access.revokeInvitation(invitationId, new Date());
  if (!revoked) return err("INVITATION_NOT_PENDING");

  await access.recordAuditEvent({
    action: "INVITATION_REVOKED",
    actorKind: "SESSION",
    actorUserId: actor.id,
    subject: invitationId,
    metadata: null,
  });

  return ok(undefined);
}
