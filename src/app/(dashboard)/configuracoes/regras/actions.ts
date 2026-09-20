"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  discardRuleDraft,
  publishRuleDraft,
  saveRuleDraft,
  workingDocument,
} from "@/application/rules/manage-rule-set.use-case";
import { revalidateGuides } from "@/application/rules/rule-impact.use-case";
import type { AuthenticatedUser } from "@/domain/access/access.types";
import {
  REQUIRED_FIELD_NAMES,
  toDocumentJson,
  type RuleDocumentJson,
} from "@/domain/conventions/rule-document";
import { isAccessDeniedError, requireAdminForAction } from "@/infrastructure/auth/guards";
import { appServices } from "@/infrastructure/composition-root";

import type { RuleActionState } from "./rules-state";

const RULES_PATH = "/configuracoes/regras";

function failure(error: string): RuleActionState {
  return { error, notice: null };
}

function success(notice: string): RuleActionState {
  return { error: null, notice };
}

type AdminOperation = (
  services: Awaited<ReturnType<typeof appServices>>,
  actor: AuthenticatedUser,
) => Promise<RuleActionState>;

/**
 * Every change to the rules re-checks the administrator role on the server.
 *
 * These actions are public endpoints: the screen not rendering a form for a
 * member is presentation, never the control.
 */
async function asAdmin(run: AdminOperation): Promise<RuleActionState> {
  const services = await appServices();

  try {
    const state = await run(services, await requireAdminForAction(services.access));
    revalidatePath(RULES_PATH);
    return state;
  } catch (error: unknown) {
    if (isAccessDeniedError(error)) return failure(error.message);
    throw error;
  }
}

/**
 * Applies one edit to the document being worked on and stores it as the draft.
 *
 * The result goes through the domain schema before it is saved, so an edit
 * that would produce rules the engine cannot run is refused here, not
 * discovered at validation time.
 */
async function editDraft(
  services: Awaited<ReturnType<typeof appServices>>,
  actor: AuthenticatedUser,
  apply: (document: RuleDocumentJson) => RuleDocumentJson,
  notice: string,
): Promise<RuleActionState> {
  const current = await workingDocument(services.rules);
  if (current === null) return failure("Não há regras carregadas para editar.");

  const saved = await saveRuleDraft(
    { document: apply(toDocumentJson(current)), notes: null },
    actor,
    services.rules,
    services.access,
  );

  if (saved.ok) return success(notice);

  return failure(
    saved.error === "UNCHANGED"
      ? "Nada mudou em relação às regras vigentes."
      : saved.error === "FORBIDDEN"
        ? "Apenas administradores podem editar regras."
        : "A alteração deixaria as regras inválidas e não foi salva.",
  );
}

const procedureSchema = z.object({
  originalCode: z.string().optional(),
  codigo: z.string().trim().min(1).max(40),
  descricao: z.string().trim().min(1).max(200),
  valor: z.string().trim().min(1),
});

export async function saveProcedureAction(
  _previous: RuleActionState,
  formData: FormData,
): Promise<RuleActionState> {
  return asAdmin(async (services, actor) => {
    const parsed = procedureSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return failure("Preencha código, descrição e valor.");

    const { originalCode, codigo, descricao, valor } = parsed.data;

    return editDraft(
      services,
      actor,
      (document) => {
        const entry = {
          codigo,
          descricao,
          valor_referencia: valor.replace(",", "."),
        };
        const others = document.procedimentos.filter(
          (procedure) => procedure.codigo !== (originalCode ?? codigo),
        );

        return { ...document, procedimentos: [...others, entry] };
      },
      `Procedimento ${codigo} salvo no rascunho.`,
    );
  });
}

export async function deleteProcedureAction(
  _previous: RuleActionState,
  formData: FormData,
): Promise<RuleActionState> {
  return asAdmin(async (services, actor) => {
    const code = formData.get("codigo");
    if (typeof code !== "string") return failure("Procedimento inválido.");

    return editDraft(
      services,
      actor,
      (document) => ({
        ...document,
        procedimentos: document.procedimentos.filter((procedure) => procedure.codigo !== code),
        // A convention cannot keep covering a procedure that no longer exists.
        convenios: document.convenios.map((convention) => ({
          ...convention,
          procedimentos_cobertos: convention.procedimentos_cobertos.filter(
            (covered) => covered !== code,
          ),
        })),
      }),
      `Procedimento ${code} removido do rascunho.`,
    );
  });
}

const conventionSchema = z.object({
  originalName: z.string().optional(),
  nome: z.string().trim().min(1).max(80),
  campos: z.array(z.enum(REQUIRED_FIELD_NAMES)).min(1),
  cobertos: z.array(z.string().trim().min(1)).min(1),
  validade: z.coerce.number().int().positive().max(3650),
  sessoes: z.coerce.number().int().positive().max(1000),
  prazo: z.coerce.number().int().positive().max(3650),
  observacao: z.string().trim().min(1).max(600),
});

export async function saveConventionAction(
  _previous: RuleActionState,
  formData: FormData,
): Promise<RuleActionState> {
  return asAdmin(async (services, actor) => {
    const parsed = conventionSchema.safeParse({
      ...Object.fromEntries(formData),
      campos: formData.getAll("campos"),
      cobertos: formData.getAll("cobertos"),
    });

    if (!parsed.success) {
      return failure(
        "Preencha nome, observação, ao menos um campo obrigatório e um procedimento coberto.",
      );
    }

    const data = parsed.data;

    return editDraft(
      services,
      actor,
      (document) => {
        const entry = {
          nome: data.nome,
          campos_obrigatorios: data.campos,
          validade_maxima_autorizacao_dias: data.validade,
          limite_sessoes_por_autorizacao: data.sessoes,
          procedimentos_cobertos: data.cobertos,
          prazo_envio_dias: data.prazo,
          observacao: data.observacao,
        };
        const others = document.convenios.filter(
          (convention) => convention.nome !== (data.originalName ?? data.nome),
        );

        return { ...document, convenios: [...others, entry] };
      },
      `Plano ${data.nome} salvo no rascunho.`,
    );
  });
}

export async function deleteConventionAction(
  _previous: RuleActionState,
  formData: FormData,
): Promise<RuleActionState> {
  return asAdmin(async (services, actor) => {
    const name = formData.get("nome");
    if (typeof name !== "string") return failure("Plano inválido.");

    return editDraft(
      services,
      actor,
      (document) => ({
        ...document,
        convenios: document.convenios.filter((convention) => convention.nome !== name),
      }),
      `Plano ${name} removido do rascunho.`,
    );
  });
}

export async function saveDocumentAction(
  _previous: RuleActionState,
  formData: FormData,
): Promise<RuleActionState> {
  return asAdmin(async (services, actor) => {
    const body = formData.get("documento");
    if (typeof body !== "string") return failure("Envie o documento de regras.");

    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      return failure("O documento não é um JSON válido.");
    }

    const saved = await saveRuleDraft(
      { document: payload, notes: null },
      actor,
      services.rules,
      services.access,
    );

    if (saved.ok) return success("Rascunho salvo a partir do JSON.");

    return failure(
      saved.error === "UNCHANGED"
        ? "Nada mudou em relação às regras vigentes."
        : saved.error === "FORBIDDEN"
          ? "Apenas administradores podem editar regras."
          : "O documento não passou na validação e não foi salvo.",
    );
  });
}

const versionSchema = z.object({ versao: z.string().trim().min(1).max(60) });

export async function renameVersionAction(
  _previous: RuleActionState,
  formData: FormData,
): Promise<RuleActionState> {
  return asAdmin(async (services, actor) => {
    const parsed = versionSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return failure("Dê um nome de versão de até 60 caracteres.");

    return editDraft(
      services,
      actor,
      (document) => ({ ...document, versao: parsed.data.versao }),
      `Versão do rascunho renomeada para ${parsed.data.versao}.`,
    );
  });
}

/** `useActionState` passes the previous state and the form; neither is needed here. */
export async function publishDraftAction(): Promise<RuleActionState> {
  return asAdmin(async (services, actor) => {
    const published = await publishRuleDraft(actor, services.rules, services.access);

    if (published.ok) {
      return success(
        `Versão ${published.value.version} publicada. Vale para as próximas validações; as guias já decididas mantêm a versão que as avaliou.`,
      );
    }

    return failure(
      published.error === "FORBIDDEN"
        ? "Apenas administradores podem publicar regras."
        : "Não há rascunho para publicar.",
    );
  });
}

/** `useActionState` passes the previous state and the form; neither is needed here. */
export async function discardDraftAction(): Promise<RuleActionState> {
  return asAdmin(async (services, actor) => {
    const discarded = await discardRuleDraft(actor, services.rules);

    return discarded.ok
      ? success("Rascunho descartado. As regras vigentes seguem intactas.")
      : failure("Apenas administradores podem descartar o rascunho.");
  });
}

/** `useActionState` passes the previous state and the form; neither is needed here. */
export async function revalidateGuidesAction(): Promise<RuleActionState> {
  return asAdmin(async (services, actor) => {
    const outcome = await revalidateGuides(actor, services);

    if (!outcome.ok) return failure("Apenas administradores podem reavaliar as guias.");

    const { evaluated, changed, rejected } = outcome.value;
    return success(
      `${evaluated} guias reavaliadas com as regras vigentes. ${changed} mudaram de decisão${
        rejected === 0 ? "" : `, ${rejected} não puderam ser lidas`
      }.`,
    );
  });
}
