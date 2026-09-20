import type { RuleDocumentJson } from "@/domain/conventions/rule-document";
import type { RuleSetStatus } from "@/domain/conventions/rule-set-status";

/** A rule set as stored: the document plus who put it there and when. */
export interface StoredRuleSet {
  readonly id: string;
  readonly version: string;
  readonly status: RuleSetStatus;
  readonly document: RuleDocumentJson;
  readonly hash: string;
  readonly notes: string | null;
  readonly createdByName: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly publishedAt: Date | null;
  readonly publishedByName: string | null;
}

export interface SaveRuleDraftInput {
  readonly version: string;
  readonly document: RuleDocumentJson;
  readonly hash: string;
  readonly notes: string | null;
  /** `null` when the system itself seeded the version. */
  readonly createdBy: string | null;
}

/**
 * Persistence for the versioned rule sets.
 *
 * Publishing is one operation on purpose: promoting a draft and archiving the
 * current version must not be able to half-happen, or the clinic ends up with
 * two published sets or none.
 */
export interface RuleSetRepository {
  findPublished(): Promise<StoredRuleSet | null>;
  findDraft(): Promise<StoredRuleSet | null>;
  findById(id: string): Promise<StoredRuleSet | null>;
  /** Creates the draft, or replaces the one already open. */
  saveDraft(input: SaveRuleDraftInput): Promise<StoredRuleSet>;
  discardDraft(): Promise<void>;
  /** Returns the published set, or `null` when the draft was already gone. */
  publishDraft(id: string, publishedBy: string, at: Date): Promise<StoredRuleSet | null>;
  /** Publishes a document directly, used to seed the first version. */
  publishDocument(input: SaveRuleDraftInput): Promise<StoredRuleSet>;
  history(limit: number): Promise<readonly StoredRuleSet[]>;
}
