import "server-only";

import type {
  InvitationMailer,
  InvitationMessage,
} from "@/application/ports/invitation-mailer.port";

/**
 * Development delivery: the invitation link goes to the server log.
 *
 * This adapter refuses to run in production. Printing a single-use credential
 * to a log is acceptable on a developer's own machine and nowhere else, so the
 * failure is loud rather than silent - a deployment without a real mailer
 * configured should not quietly leak tokens into its logs.
 */
export function createConsoleInvitationMailer(isProduction: boolean): InvitationMailer {
  return {
    name: "console",
    send(message: InvitationMessage): Promise<void> {
      if (isProduction) {
        return Promise.reject(
          new Error(
            "Nenhum provedor de e-mail configurado. Configure um antes de enviar convites em produção.",
          ),
        );
      }

      process.stdout.write(
        [
          "",
          "─".repeat(72),
          "  CONVITE VITALIS PREFLIGHT (somente desenvolvimento)",
          `  Para:    ${message.email}`,
          `  Papel:   ${message.role}`,
          `  Por:     ${message.invitedByName}`,
          `  Expira:  ${message.expiresAt.toISOString()}`,
          `  Link:    ${message.acceptUrl}`,
          "─".repeat(72),
          "",
        ].join("\n"),
      );

      return Promise.resolve();
    },
  };
}
