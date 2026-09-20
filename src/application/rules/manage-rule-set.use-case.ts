import type { AccessRepository } from "@/application/ports/access-repository.port";
import type {
  RuleSetRepository,
  StoredRuleSet,
} from "@/application/ports/rule-set-repository.port";
import type { AuthenticatedUser } from "@/domain/access/access.types";
import {
  hashDocument,
  ruleDocumentSchema,
  toDocumentJson,
  toRuleSet,
  type RuleDocument,
} from "@/domain/conventions/rule-document";
import type { RuleSet } from "@/domain/conventions/convention.types";
import { err, ok, type Result } from "@/lib/result";

export type RuleSetFailure = "FORBIDDEN" | "INVALID_DOCUMENT" | "NO_DRAFT" | "UNCHANGED";

export interface RuleSetWorkspace {
  readonly published: StoredRuleSet | null;
  readonly draft: StoredRuleSet | null;
  readonly history: readonly StoredRuleSet[];
}

const HISTORY_SIZE = 12;

export function getRuleSetWorkspace(
  actor: AuthenticatedUser,
  rules: RuleSetRepository,
): Promise<RuleSetWorkspace> {
  if (actor.role !== "ADMIN") {
    return Promise.resolve({ published: null, draft: null, history: [] });
  }

  return Promise.all([
    rules.findPublished(),
    rules.findDraft(),
    rules.history(HISTORY_SIZE),
  ]).then(([published, draft, history]) => ({ published, draft, history }));
}

/**
 * Validates and stores a draft.
 *
 * Nothing the screen sends becomes runnable rules here: the document goes
 * through the same schema the engine's loader uses, so a draft that would
 * break validation cannot be saved at all, let alone published.
 */
export async function saveRuleDraft(
  input: { readonly document: unknown; readonly notes: string | null },
  actor: AuthenticatedUser,
  rules: RuleSetRepository,
  access: AccessRepository,
): Promise<Result<StoredRuleSet, RuleSetFailure>> {
  if (actor.role !== "ADMIN") return err("FORBIDDEN");

  const parsed = ruleDocumentSchema.safeParse(input.document);
  if (!parsed.success) return err("INVALID_DOCUMENT");

  const document = parsed.data;
  const hash = hashDocument(document);

  const published = await rules.findPublished();
  if (published !== null && published.hash === hash) return err("UNCHANGED");

  const draft = await rules.saveDraft({
    version: document.versao,
    document: toDocumentJson(document),
    hash,
    notes: input.notes,
    createdBy: actor.id,
  });

  await access.recordAuditEvent({
    action: "RULE_DRAFT_SAVED",
    actorKind: "SESSION",
    actorUserId: actor.id,
    subject: draft.id,
    metadata: { version: document.versao, hash },
  });

  return ok(draft);
}

export async function discardRuleDraft(
  actor: AuthenticatedUser,
  rules: RuleSetRepository,
): Promise<Result<void, RuleSetFailure>> {
  if (actor.role !== "ADMIN") return err("FORBIDDEN");

  await rules.discardDraft();
  return ok(undefined);
}

export async function publishRuleDraft(
  actor: AuthenticatedUser,
  rules: RuleSetRepository,
  access: AccessRepository,
): Promise<Result<StoredRuleSet, RuleSetFailure>> {
  if (actor.role !== "ADMIN") return err("FORBIDDEN");

  const draft = await rules.findDraft();
  if (draft === null) return err("NO_DRAFT");

  const published = await rules.publishDraft(draft.id, actor.id, new Date());
  if (published === null) return err("NO_DRAFT");

  await access.recordAuditEvent({
    action: "RULE_SET_PUBLISHED",
    actorKind: "SESSION",
    actorUserId: actor.id,
    subject: published.id,
    metadata: { version: published.version, hash: published.hash },
  });

  return ok(published);
}

/**
 * The document being edited: the open draft, or a copy of what is published.
 *
 * Editing always starts from something that already runs, so a first edit
 * cannot produce a rule set built from nothing.
 */
export async function workingDocument(rules: RuleSetRepository): Promise<RuleDocument | null> {
  const draft = await rules.findDraft();
  if (draft !== null) return ruleDocumentSchema.parse(draft.document);

  const published = await rules.findPublished();
  return published === null ? null : ruleDocumentSchema.parse(published.document);
}

/** The draft as a runnable rule set, for previewing what it would decide. */
export function draftRuleSet(draft: StoredRuleSet): RuleSet {
  const document: RuleDocument = ruleDocumentSchema.parse(draft.document);
  return toRuleSet(document, draft.hash);
}
