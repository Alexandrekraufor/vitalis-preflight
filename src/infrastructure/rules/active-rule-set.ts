import "server-only";

import type { RuleSetRepository } from "@/application/ports/rule-set-repository.port";
import type { RuleSet } from "@/domain/conventions/convention.types";
import {
  hashDocument,
  ruleDocumentSchema,
  toDocumentJson,
  toRuleSet,
} from "@/domain/conventions/rule-document";

import { loadSeedRuleDocument } from "./file-rule-set.repository";

/**
 * The rules the engine runs right now.
 *
 * The published version in the database wins. On a deployment that has none
 * yet, the document shipped with the repository is published as the first
 * version, so the system is never without rules and the clinic starts from
 * something real instead of an empty screen.
 */
export async function activeRuleSet(rules: RuleSetRepository): Promise<RuleSet> {
  const published = await rules.findPublished();
  if (published !== null) {
    return toRuleSet(ruleDocumentSchema.parse(published.document), published.hash);
  }

  const seed = await loadSeedRuleDocument();

  try {
    const stored = await rules.publishDocument({
      version: seed.versao,
      document: toDocumentJson(seed),
      hash: hashDocument(seed),
      notes: "Versão inicial, importada do arquivo do repositório.",
      createdBy: null,
    });

    return toRuleSet(seed, stored.hash);
  } catch {
    // Two requests can reach an empty table at the same time; the unique index
    // lets exactly one win, and the loser simply reads what the winner wrote.
    const winner = await rules.findPublished();
    if (winner === null) throw new Error("Não foi possível carregar as regras vigentes.");
    return toRuleSet(ruleDocumentSchema.parse(winner.document), winner.hash);
  }
}
