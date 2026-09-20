import "server-only";

import { and, desc, eq, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type {
  RuleSetRepository,
  SaveRuleDraftInput,
  StoredRuleSet,
} from "@/application/ports/rule-set-repository.port";

import type { Database } from "../client";
import { users } from "../schema/access";
import { ruleSets } from "../schema/rules";

export function createDrizzleRuleSetRepository(database: Database): RuleSetRepository {
  const author = alias(users, "rule_set_author");
  const publisher = alias(users, "rule_set_publisher");

  const columns = {
    id: ruleSets.id,
    version: ruleSets.version,
    status: ruleSets.status,
    document: ruleSets.document,
    hash: ruleSets.hash,
    notes: ruleSets.notes,
    createdByName: author.name,
    createdAt: ruleSets.createdAt,
    updatedAt: ruleSets.updatedAt,
    publishedAt: ruleSets.publishedAt,
    publishedByName: publisher.name,
  } as const;

  const withAuthors = () =>
    database
      .select(columns)
      .from(ruleSets)
      .leftJoin(author, eq(ruleSets.createdBy, author.id))
      .leftJoin(publisher, eq(ruleSets.publishedBy, publisher.id));

  return {
    async findPublished(): Promise<StoredRuleSet | null> {
      const [row] = await withAuthors().where(eq(ruleSets.status, "PUBLISHED")).limit(1);
      return row ?? null;
    },

    async findDraft(): Promise<StoredRuleSet | null> {
      const [row] = await withAuthors().where(eq(ruleSets.status, "DRAFT")).limit(1);
      return row ?? null;
    },

    async findById(id: string): Promise<StoredRuleSet | null> {
      const [row] = await withAuthors().where(eq(ruleSets.id, id)).limit(1);
      return row ?? null;
    },

    async saveDraft(input: SaveRuleDraftInput): Promise<StoredRuleSet> {
      // One draft at a time: replacing it is what "salvar rascunho" means.
      const saved = await database.transaction(async (transaction) => {
        await transaction.delete(ruleSets).where(eq(ruleSets.status, "DRAFT"));

        const [created] = await transaction
          .insert(ruleSets)
          .values({
            version: input.version,
            status: "DRAFT",
            document: input.document,
            hash: input.hash,
            notes: input.notes,
            createdBy: input.createdBy,
          })
          .returning({ id: ruleSets.id });

        if (created === undefined) throw new Error("Falha ao salvar o rascunho.");
        return created.id;
      });

      const draft = await this.findById(saved);
      if (draft === null) throw new Error("Rascunho salvo não pôde ser lido.");
      return draft;
    },

    async discardDraft(): Promise<void> {
      await database.delete(ruleSets).where(eq(ruleSets.status, "DRAFT"));
    },

    async publishDraft(id: string, publishedBy: string, at: Date): Promise<StoredRuleSet | null> {
      const published = await database.transaction(async (transaction) => {
        const [draft] = await transaction
          .select({ id: ruleSets.id })
          .from(ruleSets)
          .where(and(eq(ruleSets.id, id), eq(ruleSets.status, "DRAFT")))
          .limit(1);

        if (draft === undefined) return null;

        // The order matters: the partial unique index allows exactly one
        // published row, so the previous one is archived first.
        await transaction
          .update(ruleSets)
          .set({ status: "ARCHIVED", updatedAt: at })
          .where(and(eq(ruleSets.status, "PUBLISHED"), ne(ruleSets.id, id)));

        await transaction
          .update(ruleSets)
          .set({ status: "PUBLISHED", publishedAt: at, publishedBy, updatedAt: at })
          .where(eq(ruleSets.id, id));

        return draft.id;
      });

      return published === null ? null : await this.findById(published);
    },

    async publishDocument(input: SaveRuleDraftInput): Promise<StoredRuleSet> {
      const id = await database.transaction(async (transaction) => {
        const now = new Date();

        await transaction
          .update(ruleSets)
          .set({ status: "ARCHIVED", updatedAt: now })
          .where(eq(ruleSets.status, "PUBLISHED"));

        const [created] = await transaction
          .insert(ruleSets)
          .values({
            version: input.version,
            status: "PUBLISHED",
            document: input.document,
            hash: input.hash,
            notes: input.notes,
            createdBy: input.createdBy,
            publishedAt: now,
            publishedBy: input.createdBy,
          })
          .returning({ id: ruleSets.id });

        if (created === undefined) throw new Error("Falha ao publicar as regras.");
        return created.id;
      });

      const stored = await this.findById(id);
      if (stored === null) throw new Error("Regras publicadas não puderam ser lidas.");
      return stored;
    },

    async history(limit: number): Promise<readonly StoredRuleSet[]> {
      return withAuthors().orderBy(desc(ruleSets.createdAt)).limit(limit);
    },
  };
}
