"use server";

import { redirect } from "next/navigation";

import { resolveSession } from "@/infrastructure/auth/guards";
import { clearSessionCookie, sessionTokens } from "@/infrastructure/auth/session";
import { appServices } from "@/infrastructure/composition-root";

/**
 * Signs the current device out.
 *
 * The server-side session row is deleted first: clearing the cookie alone would
 * leave a token that still works for anyone who had copied it.
 */
export async function logoutAction(): Promise<void> {
  const services = await appServices();
  const session = await resolveSession(services.access);

  if (session !== null) {
    await services.access.deleteSessionByTokenHash(sessionTokens.hash(session.token));
    await services.access.recordAuditEvent({
      action: "USER_LOGGED_OUT",
      actorKind: "SESSION",
      actorUserId: session.user.id,
      subject: session.user.email,
      metadata: null,
    });
  }

  await clearSessionCookie();
  redirect("/login");
}
