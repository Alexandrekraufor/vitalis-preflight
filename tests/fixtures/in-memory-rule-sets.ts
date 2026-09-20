import { randomUUID } from "node:crypto";

import type {
  RuleSetRepository,
  SaveRuleDraftInput,
  StoredRuleSet,
} from "@/application/ports/rule-set-repository.port";

/**
 * Versioned rule sets in memory, with the same invariants the database holds:
 * one published version and one draft at a time.
 */
export function createInMemoryRuleSetRepository(): RuleSetRepository {
  const sets = new Map<string, StoredRuleSet>();

  const byStatus = (status: StoredRuleSet["status"]): StoredRuleSet | null =>
    [...sets.values()].find((set) => set.status === status) ?? null;

  const store = (input: SaveRuleDraftInput, status: StoredRuleSet["status"]): StoredRuleSet => {
    const now = new Date();
    const stored: StoredRuleSet = {
      id: randomUUID(),
      version: input.version,
      status,
      document: input.document,
      hash: input.hash,
      notes: input.notes,
      createdByName: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: status === "PUBLISHED" ? now : null,
      publishedByName: null,
    };
    sets.set(stored.id, stored);
    return stored;
  };

  const archivePublished = (at: Date): void => {
    for (const [id, set] of sets) {
      if (set.status === "PUBLISHED") {
        sets.set(id, { ...set, status: "ARCHIVED", updatedAt: at });
      }
    }
  };

  return {
    findPublished(): Promise<StoredRuleSet | null> {
      return Promise.resolve(byStatus("PUBLISHED"));
    },

    findDraft(): Promise<StoredRuleSet | null> {
      return Promise.resolve(byStatus("DRAFT"));
    },

    findById(id: string): Promise<StoredRuleSet | null> {
      return Promise.resolve(sets.get(id) ?? null);
    },

    saveDraft(input: SaveRuleDraftInput): Promise<StoredRuleSet> {
      const existing = byStatus("DRAFT");
      if (existing !== null) sets.delete(existing.id);
      return Promise.resolve(store(input, "DRAFT"));
    },

    discardDraft(): Promise<void> {
      const existing = byStatus("DRAFT");
      if (existing !== null) sets.delete(existing.id);
      return Promise.resolve();
    },

    publishDraft(id: string, _publishedBy: string, at: Date): Promise<StoredRuleSet | null> {
      const draft = sets.get(id);
      if (draft === undefined || draft.status !== "DRAFT") return Promise.resolve(null);

      archivePublished(at);
      const published: StoredRuleSet = {
        ...draft,
        status: "PUBLISHED",
        publishedAt: at,
        updatedAt: at,
      };
      sets.set(id, published);
      return Promise.resolve(published);
    },

    publishDocument(input: SaveRuleDraftInput): Promise<StoredRuleSet> {
      archivePublished(new Date());
      return Promise.resolve(store(input, "PUBLISHED"));
    },

    history(limit: number): Promise<readonly StoredRuleSet[]> {
      return Promise.resolve(
        [...sets.values()]
          .toSorted((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
          .slice(0, limit),
      );
    },
  };
}
