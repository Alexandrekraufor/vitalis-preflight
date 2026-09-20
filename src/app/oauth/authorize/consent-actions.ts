"use server";

import { redirect } from "next/navigation";

import {
  approveAuthorization,
  denyAuthorization,
} from "@/application/access/oauth-authorization.use-case";
import { oauthDependencies } from "@/infrastructure/auth/oauth-secrets";
import { requireUserForAction } from "@/infrastructure/auth/guards";
import { appServices } from "@/infrastructure/composition-root";

/**
 * The two ends of the consent screen.
 *
 * Both re-read the pending request from storage and both scope it to the
 * signed-in user, so the only thing the browser sends back is an opaque id.
 * Nothing posted here can change the client, the scope or the redirect target:
 * those were fixed when the request was created and validated.
 */
export async function approveConsentAction(formData: FormData): Promise<void> {
  const requestId = formData.get("requestId");
  if (typeof requestId !== "string") redirect("/oauth/authorize?erro=pedido");

  const services = await appServices();
  const user = await requireUserForAction(services.access);

  const approved = await approveAuthorization(requestId, user, oauthDependencies(services));
  if (!approved.ok) redirect("/oauth/authorize?erro=expirado");

  redirect(approved.value.redirectTo);
}

export async function denyConsentAction(formData: FormData): Promise<void> {
  const requestId = formData.get("requestId");
  if (typeof requestId !== "string") redirect("/oauth/authorize?erro=pedido");

  const services = await appServices();
  const user = await requireUserForAction(services.access);

  const denied = await denyAuthorization(requestId, user, oauthDependencies(services));
  if (!denied.ok) redirect("/oauth/authorize?erro=pedido");

  redirect(denied.value.redirectTo);
}
