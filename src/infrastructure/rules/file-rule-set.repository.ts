import { readFile } from "node:fs/promises";
import path from "node:path";

import type { RuleSet } from "@/domain/conventions/convention.types";
import {
  hashDocument,
  ruleDocumentSchema,
  toRuleSet,
  type RuleDocument,
} from "@/domain/conventions/rule-document";

export const DEFAULT_RULE_FILE = path.join(
  process.cwd(),
  "data",
  "source",
  "regras_convenio.json",
);

/**
 * Reads a rule document from JSON, refusing anything the engine could not run.
 *
 * The schema lives in the domain because the same document format is what the
 * file holds, what the database stores and what the editing screen writes.
 */
export function parseRuleDocument(contents: string): RuleDocument {
  let payload: unknown;
  try {
    payload = JSON.parse(contents);
  } catch {
    throw new Error("Arquivo de regras inválido: não é um JSON válido.");
  }

  const parsed = ruleDocumentSchema.safeParse(payload);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Arquivo de regras inválido:\n${issues}`);
  }

  return parsed.data;
}

const cache = new Map<string, Promise<RuleDocument>>();

/**
 * The rule document that ships with the repository.
 *
 * It is the seed: on a deployment with no published rules yet, this is what
 * gets published as the first version. After that the database holds the
 * versions and this file stays as the origin, which keeps the seed script and
 * the tests working without a database.
 */
export function loadSeedRuleDocument(
  filePath: string = DEFAULT_RULE_FILE,
): Promise<RuleDocument> {
  const cached = cache.get(filePath);
  if (cached !== undefined) return cached;

  const loading = readFile(filePath, "utf8").then(parseRuleDocument);
  cache.set(filePath, loading);
  return loading;
}

/** The seeded document as a runnable rule set. */
export async function loadRuleSet(filePath: string = DEFAULT_RULE_FILE): Promise<RuleSet> {
  const document = await loadSeedRuleDocument(filePath);
  return toRuleSet(document, hashDocument(document));
}

/** Test seam: builds a rule set from an in-memory file body. */
export function ruleSetFromJson(contents: string): RuleSet {
  const document = parseRuleDocument(contents);
  return toRuleSet(document, hashDocument(document));
}
