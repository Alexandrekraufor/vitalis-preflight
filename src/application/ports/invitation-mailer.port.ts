import type { UserRole } from "@/domain/access/access.types";

export interface InvitationMessage {
  readonly email: string;
  readonly role: UserRole;
  readonly invitedByName: string;
  /** The full, single-use URL. Never persisted and never logged in production. */
  readonly acceptUrl: string;
  readonly expiresAt: Date;
}

/**
 * Delivery of an invitation link.
 *
 * Declared as a port so the use case never learns whether the link went out by
 * SMTP, through a provider, or - in development - straight to the server log.
 * Adding Resend or SES later is a new adapter and an environment variable.
 */
export interface InvitationMailer {
  readonly name: string;
  send(message: InvitationMessage): Promise<void>;
}
