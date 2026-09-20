"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { inviteMember } from "@/application/access/invite-member.use-case";
import {
  revokeInvitation,
  setMemberRole,
  setMemberStatus,
} from "@/application/access/manage-team.use-case";
import { USER_ROLES, type AuthenticatedUser } from "@/domain/access/access.types";
import { requireAdminForAction, isAccessDeniedError } from "@/infrastructure/auth/guards";
import { sessionTokens } from "@/infrastructure/auth/session";
import { appServices } from "@/infrastructure/composition-root";
import { env, isProduction } from "@/lib/env";

import type { TeamActionState } from "./team-state";

const TEAM_PATH = "/configuracoes/equipe";

function failure(error: string): TeamActionState {
  return { error, notice: null, inviteUrl: null };
}

/**
 * Wraps an administrator action so a denied call becomes a message instead of
 * an unhandled rejection — and so authorization is re-checked on the server for
 * every single invocation, never inferred from what the page chose to render.
 */
type AdminOperation = (
  services: Awaited<ReturnType<typeof appServices>>,
  actor: AuthenticatedUser,
) => Promise<TeamActionState>;

async function asAdmin(run: AdminOperation): Promise<TeamActionState> {
  const services = await appServices();

  try {
    const actor = await requireAdminForAction(services.access);
    const state = await run(services, actor);
    revalidatePath(TEAM_PATH);
    return state;
  } catch (error: unknown) {
    if (isAccessDeniedError(error)) return failure(error.message);
    throw error;
  }
}

const inviteSchema = z.object({
  email: z.email().max(320),
  role: z.enum(USER_ROLES),
});

export async function inviteMemberAction(
  _previous: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  return asAdmin(async (services, actor) => {
    const parsed = inviteSchema.safeParse({
      email: formData.get("email"),
      role: formData.get("role"),
    });

    if (!parsed.success) return failure("Informe um e-mail válido e um nível de acesso.");

    const result = await inviteMember(
      { email: parsed.data.email, role: parsed.data.role, invitedBy: actor },
      {
        access: services.access,
        tokens: sessionTokens,
        mailer: services.mailer,
        appUrl: env().APP_URL,
        revealLinkToAdmin: !isProduction(),
      },
    );

    if (!result.ok) {
      return failure(
        result.error === "ALREADY_A_MEMBER"
          ? "Esse e-mail já pertence a um membro da equipe."
          : "Já existe um convite pendente para esse e-mail.",
      );
    }

    return {
      error: null,
      notice: `Convite enviado para ${result.value.email}.`,
      inviteUrl: result.value.acceptUrl,
    };
  });
}

const idSchema = z.uuid();

export async function revokeInvitationAction(
  _previous: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  return asAdmin(async (services, actor) => {
    const id = idSchema.safeParse(formData.get("invitationId"));
    if (!id.success) return failure("Convite inválido.");

    const result = await revokeInvitation(id.data, actor, services.access);

    return result.ok
      ? { error: null, notice: "Convite revogado.", inviteUrl: null }
      : failure("Este convite não está mais pendente.");
  });
}

const statusSchema = z.object({ userId: z.uuid(), disable: z.enum(["true", "false"]) });

export async function setMemberStatusAction(
  _previous: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  return asAdmin(async (services, actor) => {
    const parsed = statusSchema.safeParse({
      userId: formData.get("userId"),
      disable: formData.get("disable"),
    });

    if (!parsed.success) return failure("Membro inválido.");

    const disable = parsed.data.disable === "true";
    const result = await setMemberStatus(
      { targetId: parsed.data.userId, disable },
      actor,
      services.access,
    );

    if (!result.ok) return failure(describeTeamFailure(result.error));

    return {
      error: null,
      notice: disable ? "Membro desativado." : "Membro reativado.",
      inviteUrl: null,
    };
  });
}

const roleSchema = z.object({ userId: z.uuid(), role: z.enum(USER_ROLES) });

export async function setMemberRoleAction(
  _previous: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  return asAdmin(async (services, actor) => {
    const parsed = roleSchema.safeParse({
      userId: formData.get("userId"),
      role: formData.get("role"),
    });

    if (!parsed.success) return failure("Nível de acesso inválido.");

    const result = await setMemberRole(
      { targetId: parsed.data.userId, role: parsed.data.role },
      actor,
      services.access,
    );

    return result.ok
      ? { error: null, notice: "Nível de acesso atualizado.", inviteUrl: null }
      : failure(describeTeamFailure(result.error));
  });
}

function describeTeamFailure(failureCode: string): string {
  switch (failureCode) {
    case "CANNOT_CHANGE_SELF":
      return "Você não pode alterar a própria conta aqui.";
    case "LAST_ADMIN":
      return "A equipe precisa de pelo menos um administrador ativo.";
    default:
      return "Membro não encontrado.";
  }
}
