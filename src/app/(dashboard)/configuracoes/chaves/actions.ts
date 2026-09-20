"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  issueApiCredential,
  revokeApiCredential,
} from "@/application/access/manage-api-credentials.use-case";
import type { AuthenticatedUser } from "@/domain/access/access.types";
import { API_SCOPES, API_SURFACES, apiSurfaceLabel } from "@/domain/access/api-credential";
import { revokeClientAccess } from "@/application/access/oauth-authorization.use-case";
import {
  isAccessDeniedError,
  requireAdminForAction,
  requireUserForAction,
} from "@/infrastructure/auth/guards";
import { oauthDependencies } from "@/infrastructure/auth/oauth-secrets";
import { generateToken, hashToken } from "@/infrastructure/auth/tokens";
import { appServices } from "@/infrastructure/composition-root";

import type { CredentialActionState } from "./credential-state";

const CREDENTIALS_PATH = "/configuracoes/chaves";
const INTEGRATIONS_PATH = "/integracoes";

const TOKENS = { generate: generateToken, hash: hashToken } as const;

function failure(error: string): CredentialActionState {
  return { error, notice: null, issuedToken: null, issuedName: null };
}

/**
 * Re-checks authorization on the server for every invocation.
 *
 * A Server Action is a public endpoint: the page hiding this form from a
 * member is presentation, never the control.
 */
type AdminOperation = (
  services: Awaited<ReturnType<typeof appServices>>,
  actor: AuthenticatedUser,
) => Promise<CredentialActionState>;

async function asAdmin(run: AdminOperation): Promise<CredentialActionState> {
  const services = await appServices();

  try {
    const actor = await requireAdminForAction(services.access);
    const state = await run(services, actor);
    revalidatePath(CREDENTIALS_PATH);
    return state;
  } catch (error: unknown) {
    if (isAccessDeniedError(error)) return failure(error.message);
    throw error;
  }
}

const issueSchema = z.object({
  name: z.string().trim().min(1).max(60),
  surface: z.enum(API_SURFACES),
  scopes: z.array(z.enum(API_SCOPES)).min(1),
});

export async function issueCredentialAction(
  _previous: CredentialActionState,
  formData: FormData,
): Promise<CredentialActionState> {
  return asAdmin(async (services, actor) => {
    const parsed = issueSchema.safeParse({
      name: formData.get("name"),
      surface: formData.get("surface"),
      scopes: formData.getAll("scopes"),
    });

    if (!parsed.success) {
      return failure(
        "Dê um nome de até 60 caracteres, escolha a superfície e ao menos uma permissão.",
      );
    }

    const issued = await issueApiCredential(parsed.data, actor, services.access, TOKENS);

    if (!issued.ok) {
      return failure(
        issued.error === "FORBIDDEN"
          ? "Apenas administradores podem criar chaves."
          : issued.error === "NO_SCOPE"
            ? "Escolha ao menos uma permissão para a chave."
            : "Dê um nome de até 60 caracteres para a chave.",
      );
    }

    return {
      error: null,
      notice: `Chave de ${apiSurfaceLabel(parsed.data.surface)} criada. Copie agora: ela não será mostrada de novo.`,
      issuedToken: issued.value.token,
      issuedName: issued.value.credential.name,
    };
  });
}

const revokeSchema = z.object({ credentialId: z.uuid() });

export async function revokeCredentialAction(
  _previous: CredentialActionState,
  formData: FormData,
): Promise<CredentialActionState> {
  return asAdmin(async (services, actor) => {
    const parsed = revokeSchema.safeParse({ credentialId: formData.get("credentialId") });
    if (!parsed.success) return failure("Chave inválida.");

    const revoked = await revokeApiCredential(
      parsed.data.credentialId,
      actor,
      services.access,
    );

    if (!revoked.ok) {
      return failure(
        revoked.error === "FORBIDDEN"
          ? "Apenas administradores podem revogar chaves."
          : "Esta chave já havia sido revogada.",
      );
    }

    return {
      error: null,
      notice: "Chave revogada. Qualquer chamada com ela passa a receber 401.",
      issuedToken: null,
      issuedName: null,
    };
  });
}

const revokeClientSchema = z.object({ clientId: z.uuid() });

/**
 * Withdraws an application's access.
 *
 * This one is not restricted to administrators: the approval belongs to the
 * person who gave it, and anybody may take back their own.
 */
export async function revokeClientAccessAction(
  _previous: CredentialActionState,
  formData: FormData,
): Promise<CredentialActionState> {
  const services = await appServices();

  try {
    const actor = await requireUserForAction(services.access);
    const parsed = revokeClientSchema.safeParse({ clientId: formData.get("clientId") });
    if (!parsed.success) return failure("Aplicativo inválido.");

    await revokeClientAccess(parsed.data.clientId, actor, oauthDependencies(services));
    // The card lives on the integrations screen; the keys screen links to it.
    revalidatePath(INTEGRATIONS_PATH);
    revalidatePath(CREDENTIALS_PATH);

    return {
      error: null,
      notice: "Acesso revogado. O aplicativo precisa ser autorizado de novo para voltar.",
      issuedToken: null,
      issuedName: null,
    };
  } catch (error: unknown) {
    if (isAccessDeniedError(error)) return failure(error.message);
    throw error;
  }
}
