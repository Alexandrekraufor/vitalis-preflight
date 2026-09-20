import type { AccessRepository } from "@/application/ports/access-repository.port";
import type { InvitationMailer } from "@/application/ports/invitation-mailer.port";
import type { AuthenticatedUser, UserRole } from "@/domain/access/access.types";
import { normalizeEmail } from "@/domain/access/access.types";
import { invitationExpiryFrom } from "@/domain/access/invitation";
import { err, ok, type Result } from "@/lib/result";

import type { SessionTokenFactory } from "./authenticate.use-case";

export interface InviteMemberDependencies {
  readonly access: AccessRepository;
  readonly tokens: SessionTokenFactory;
  readonly mailer: InvitationMailer;
  /** Absolute base URL of the application, used to build the accept link. */
  readonly appUrl: string;
  /** True only outside production; controls whether the link comes back to the UI. */
  readonly revealLinkToAdmin: boolean;
}

export interface InviteMemberInput {
  readonly email: string;
  readonly role: UserRole;
  readonly invitedBy: AuthenticatedUser;
}

export type InviteMemberFailure = "ALREADY_A_MEMBER" | "ALREADY_INVITED";

export interface InvitationCreated {
  readonly invitationId: string;
  readonly email: string;
  readonly expiresAt: Date;
  /**
   * Only populated outside production, so an administrator can copy the link
   * while no mail provider is configured. In production this is always `null`
   * and the token exists solely inside the delivered message.
   */
  readonly acceptUrl: string | null;
}

/**
 * Creates a single-use invitation and hands the link to the mailer.
 *
 * The raw token exists only in memory and in the outgoing message; the
 * database stores its digest, so nobody - including an administrator reading
 * the table - can recover a pending link.
 */
export async function inviteMember(
  input: InviteMemberInput,
  deps: InviteMemberDependencies,
): Promise<Result<InvitationCreated, InviteMemberFailure>> {
  const { access, tokens, mailer, appUrl, revealLinkToAdmin } = deps;
  const email = normalizeEmail(input.email);

  if ((await access.findUserByEmail(email)) !== null) {
    return err("ALREADY_A_MEMBER");
  }

  if ((await access.findPendingInvitationForEmail(email)) !== null) {
    return err("ALREADY_INVITED");
  }

  const token = tokens.create();
  const expiresAt = invitationExpiryFrom(new Date());

  const invitationId = await access.createInvitation({
    email,
    role: input.role,
    tokenHash: tokens.hash(token),
    expiresAt,
    createdBy: input.invitedBy.id,
  });

  const acceptUrl = `${appUrl.replace(/\/$/, "")}/invite/${token}`;

  await mailer.send({
    email,
    role: input.role,
    invitedByName: input.invitedBy.name,
    acceptUrl,
    expiresAt,
  });

  await access.recordAuditEvent({
    action: "INVITATION_CREATED",
    actorKind: "SESSION",
    actorUserId: input.invitedBy.id,
    subject: email,
    metadata: { role: input.role, mailer: mailer.name },
  });

  return ok({
    invitationId,
    email,
    expiresAt,
    acceptUrl: revealLinkToAdmin ? acceptUrl : null,
  });
}
