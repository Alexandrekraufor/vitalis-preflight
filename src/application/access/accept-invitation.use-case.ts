import type { AccessRepository } from "@/application/ports/access-repository.port";
import type { AuthenticatedUser } from "@/domain/access/access.types";
import {
  checkInvitationUsable,
  type InvitationRejection,
} from "@/domain/access/invitation";
import { checkPassword, type PasswordRejection } from "@/domain/access/password-policy";
import { err, ok, type Result } from "@/lib/result";

import type { SessionTokenFactory } from "./authenticate.use-case";

export interface InvitationHasher {
  hash(password: string): Promise<string>;
}

export interface AcceptInvitationDependencies {
  readonly access: AccessRepository;
  readonly hasher: InvitationHasher;
  readonly tokens: SessionTokenFactory;
  readonly sessionLifetimeMs: number;
}

export interface AcceptInvitationInput {
  /** The raw token from the URL. Hashed here; never stored or logged. */
  readonly token: string;
  readonly name: string;
  readonly password: string;
}

export type AcceptInvitationFailure =
  | { readonly kind: "INVITATION"; readonly reason: InvitationRejection }
  | { readonly kind: "PASSWORD"; readonly reason: PasswordRejection }
  | { readonly kind: "NAME_REQUIRED" }
  | { readonly kind: "EMAIL_TAKEN" };

export interface AcceptedInvitation {
  readonly user: AuthenticatedUser;
  readonly sessionToken: string;
  readonly expiresAt: Date;
}

/**
 * Turns a valid invitation into an account, and signs the new member in.
 *
 * The e-mail is taken from the stored invitation, never from the submitted
 * form: whoever holds the link can only create the account it was issued for.
 *
 * Acceptance is claimed before the user is created, and the claim is a
 * conditional update on `status = PENDING`. Two requests racing on the same
 * token therefore produce one account, not two.
 */
export async function acceptInvitation(
  input: AcceptInvitationInput,
  { access, hasher, tokens, sessionLifetimeMs }: AcceptInvitationDependencies,
): Promise<Result<AcceptedInvitation, AcceptInvitationFailure>> {
  const invitation = await access.findInvitationByTokenHash(tokens.hash(input.token));
  const rejection = checkInvitationUsable(invitation, new Date());

  if (rejection !== null || invitation === null) {
    return err({ kind: "INVITATION", reason: rejection ?? "NOT_FOUND" });
  }

  const name = input.name.trim();
  if (name === "") return err({ kind: "NAME_REQUIRED" });

  const passwordRejection = checkPassword(input.password);
  if (passwordRejection !== null) {
    return err({ kind: "PASSWORD", reason: passwordRejection });
  }

  if ((await access.findUserByEmail(invitation.email)) !== null) {
    return err({ kind: "EMAIL_TAKEN" });
  }

  const now = new Date();
  const claimed = await access.markInvitationAccepted(invitation.id, now);

  if (!claimed) {
    return err({ kind: "INVITATION", reason: "ALREADY_ACCEPTED" });
  }

  const passwordHash = await hasher.hash(input.password);
  const user = await access.createUser({
    email: invitation.email,
    name,
    passwordHash,
    role: invitation.role,
  });

  const sessionToken = tokens.create();
  const expiresAt = new Date(now.getTime() + sessionLifetimeMs);

  await access.createSession(user.id, tokens.hash(sessionToken), expiresAt);
  await access.recordLogin(user.id, now);
  await access.recordAuditEvent({
    action: "INVITATION_ACCEPTED",
    actorKind: "SESSION",
    actorUserId: user.id,
    subject: invitation.email,
    metadata: { role: invitation.role },
  });

  return ok({ user, sessionToken, expiresAt });
}

/** Read-only preview for the invite page, before anything is submitted. */
export async function previewInvitation(
  token: string,
  access: AccessRepository,
  tokens: SessionTokenFactory,
): Promise<Result<{ readonly email: string }, InvitationRejection>> {
  const invitation = await access.findInvitationByTokenHash(tokens.hash(token));
  const rejection = checkInvitationUsable(invitation, new Date());

  if (rejection !== null || invitation === null) {
    return err(rejection ?? "NOT_FOUND");
  }

  return ok({ email: invitation.email });
}
