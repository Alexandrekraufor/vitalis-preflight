"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { acceptInvitation } from "@/application/access/accept-invitation.use-case";
import { invitationRejectionMessage } from "@/domain/access/invitation";
import { passwordRejectionMessage } from "@/domain/access/password-policy";
import { hashPassword } from "@/infrastructure/auth/password-hasher";
import {
  SESSION_LIFETIME_MS,
  sessionTokens,
  writeSessionCookie,
} from "@/infrastructure/auth/session";
import { appServices } from "@/infrastructure/composition-root";

import type { AcceptInviteState } from "./invite-state";

const acceptSchema = z.object({
  token: z.string().min(1).max(512),
  name: z.string().min(1).max(120),
  password: z.string().min(1).max(256),
  passwordConfirmation: z.string().min(1).max(256),
});

/**
 * Creates the account behind an invitation.
 *
 * Note what is *not* read from the form: the e-mail. It comes from the stored
 * invitation, so holding a link lets somebody create the one account it was
 * issued for and no other.
 */
export async function acceptInviteAction(
  _previous: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const parsed = acceptSchema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });

  if (!parsed.success) {
    return { error: "Preencha nome e senha para continuar." };
  }

  if (parsed.data.password !== parsed.data.passwordConfirmation) {
    return { error: "As senhas não conferem." };
  }

  const services = await appServices();

  const result = await acceptInvitation(
    {
      token: parsed.data.token,
      name: parsed.data.name,
      password: parsed.data.password,
    },
    {
      access: services.access,
      hasher: { hash: hashPassword },
      tokens: sessionTokens,
      sessionLifetimeMs: SESSION_LIFETIME_MS,
    },
  );

  if (!result.ok) {
    switch (result.error.kind) {
      case "INVITATION":
        return { error: invitationRejectionMessage(result.error.reason) };
      case "PASSWORD":
        return { error: passwordRejectionMessage(result.error.reason) };
      case "NAME_REQUIRED":
        return { error: "Informe seu nome." };
      case "EMAIL_TAKEN":
        return { error: "Já existe uma conta para este e-mail. Entre pela tela de login." };
    }
  }

  await writeSessionCookie(result.value.sessionToken, result.value.expiresAt);
  redirect("/");
}
