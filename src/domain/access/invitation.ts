import type { InvitationStatus } from "./access.types";

/** How long a new invitation stays usable. */
export const INVITATION_LIFETIME_DAYS = 7;

/**
 * Why an invitation cannot be used. Every reason is reported to the visitor as
 * a distinct, human-readable outcome - but never in a way that reveals whether
 * a *different* token would have worked.
 */
export type InvitationRejection =
  | "NOT_FOUND"
  | "ALREADY_ACCEPTED"
  | "REVOKED"
  | "EXPIRED";

export interface InvitationState {
  readonly status: InvitationStatus;
  readonly expiresAt: Date;
}

/**
 * The single place that decides whether an invitation may still be redeemed.
 *
 * Pure and exhaustively tested, because every one of these branches is a way
 * for somebody to get an account they should not have.
 */
export function checkInvitationUsable(
  invitation: InvitationState | null,
  now: Date,
): InvitationRejection | null {
  if (invitation === null) return "NOT_FOUND";
  if (invitation.status === "ACCEPTED") return "ALREADY_ACCEPTED";
  if (invitation.status === "REVOKED") return "REVOKED";
  if (invitation.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  return null;
}

const REJECTION_MESSAGES: Readonly<Record<InvitationRejection, string>> = {
  NOT_FOUND: "Este convite não é válido. Peça um novo convite ao administrador.",
  ALREADY_ACCEPTED: "Este convite já foi usado. Entre com o e-mail e a senha que você cadastrou.",
  REVOKED: "Este convite foi cancelado. Peça um novo convite ao administrador.",
  EXPIRED: "Este convite expirou. Peça um novo convite ao administrador.",
};

export function invitationRejectionMessage(rejection: InvitationRejection): string {
  return REJECTION_MESSAGES[rejection];
}

export function invitationExpiryFrom(now: Date): Date {
  return new Date(now.getTime() + INVITATION_LIFETIME_DAYS * 86_400_000);
}
