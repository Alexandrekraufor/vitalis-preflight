import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { importGuides } from "@/application/imports/import-guides.use-case";
import {
  draftRuleSet,
  getRuleSetWorkspace,
  publishRuleDraft,
  saveRuleDraft,
  workingDocument,
} from "@/application/rules/manage-rule-set.use-case";
import {
  previewRuleImpact,
  revalidateGuides,
} from "@/application/rules/rule-impact.use-case";
import type { AuthenticatedUser } from "@/domain/access/access.types";
import {
  hashDocument,
  toDocumentJson,
  type RuleDocumentJson,
} from "@/domain/conventions/rule-document";
import { parseGuideCsv } from "@/infrastructure/csv/guide-csv.parser";
import { loadSeedRuleDocument } from "@/infrastructure/rules/file-rule-set.repository";
import { createTestServices, type TestServices } from "@tests/fixtures/test-services";

let services: TestServices;

const ADMIN: AuthenticatedUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "carla@clinicavitalis.test",
  name: "Carla",
  role: "ADMIN",
  status: "ACTIVE",
};

const MEMBER: AuthenticatedUser = {
  ...ADMIN,
  id: "22222222-2222-4222-8222-222222222222",
  role: "MEMBER",
};

/** Publishes the document that ships with the repository, as the app does. */
async function publishSeed(): Promise<RuleDocumentJson> {
  const seed = await loadSeedRuleDocument();
  const document = toDocumentJson(seed);

  await services.rules.publishDocument({
    version: seed.versao,
    document,
    hash: hashDocument(seed),
    notes: null,
    createdBy: null,
  });

  return document;
}

async function seedGuides(): Promise<void> {
  const contents = readFileSync(
    path.join(process.cwd(), "data", "source", "guias.csv"),
    "utf8",
  );
  const parsed = parseGuideCsv(contents);
  if (!parsed.ok) throw new Error(parsed.error.message);

  await importGuides(
    { records: parsed.value, source: "SEED", fileName: "guias.csv", fileHash: null },
    services,
  );
}

/** A plan whose session limit is one, which blocks every later session. */
function withTightSessionLimit(document: RuleDocumentJson): RuleDocumentJson {
  return {
    ...document,
    versao: "teste/limite-1",
    convenios: document.convenios.map((convention) => ({
      ...convention,
      limite_sessoes_por_autorizacao: 1,
    })),
  };
}

beforeEach(() => {
  services = createTestServices();
});

describe("editing the rule set", () => {
  it("refuses a document the engine could not run", async () => {
    const document = await publishSeed();

    const broken: RuleDocumentJson = {
      ...document,
      convenios: document.convenios.map((convention) => ({
        ...convention,
        procedimentos_cobertos: [...convention.procedimentos_cobertos, "00000000"],
      })),
    };

    const saved = await saveRuleDraft(
      { document: broken, notes: null },
      ADMIN,
      services.rules,
      services.access,
    );

    expect(saved).toEqual({ ok: false, error: "INVALID_DOCUMENT" });
    expect(await services.rules.findDraft()).toBeNull();
  });

  it("refuses a draft identical to what is published", async () => {
    const document = await publishSeed();

    const saved = await saveRuleDraft(
      { document, notes: null },
      ADMIN,
      services.rules,
      services.access,
    );

    expect(saved).toEqual({ ok: false, error: "UNCHANGED" });
  });

  it("keeps the published version untouched while a draft exists", async () => {
    const document = await publishSeed();
    const before = await services.rules.findPublished();

    await saveRuleDraft(
      { document: withTightSessionLimit(document), notes: null },
      ADMIN,
      services.rules,
      services.access,
    );

    const after = await services.rules.findPublished();
    expect(after?.hash).toBe(before?.hash);
    expect(after?.version).toBe(before?.version);
  });

  it("promotes the draft and archives the previous version on publish", async () => {
    const document = await publishSeed();
    const original = await services.rules.findPublished();

    await saveRuleDraft(
      { document: withTightSessionLimit(document), notes: null },
      ADMIN,
      services.rules,
      services.access,
    );
    const published = await publishRuleDraft(ADMIN, services.rules, services.access);

    if (!published.ok) throw new Error("publicação falhou");

    expect(published.value.version).toBe("teste/limite-1");
    expect(await services.rules.findDraft()).toBeNull();

    const history = await services.rules.history(10);
    const previous = history.find((entry) => entry.id === original?.id);
    expect(previous?.status).toBe("ARCHIVED");
  });

  it("starts an edit from what is published", async () => {
    const document = await publishSeed();
    const working = await workingDocument(services.rules);

    expect(working?.versao).toBe(document.versao);
    expect(working?.convenios).toHaveLength(document.convenios.length);
  });
});

describe("only administrators touch the rules", () => {
  it("refuses to save, publish or revalidate for a member", async () => {
    const document = await publishSeed();

    const saved = await saveRuleDraft(
      { document: withTightSessionLimit(document), notes: null },
      MEMBER,
      services.rules,
      services.access,
    );
    const published = await publishRuleDraft(MEMBER, services.rules, services.access);
    const revalidated = await revalidateGuides(MEMBER, services);

    expect(saved).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(published).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(revalidated).toEqual({ ok: false, error: "FORBIDDEN" });
  });

  it("shows a member no rule set at all", async () => {
    await publishSeed();

    const workspace = await getRuleSetWorkspace(MEMBER, services.rules);

    expect(workspace.published).toBeNull();
    expect(workspace.history).toHaveLength(0);
  });
});

describe("impact of a draft", () => {
  it("says which guides would change, without writing anything", async () => {
    const document = await publishSeed();
    await seedGuides();

    const before = await services.guides.list({});
    const beforeStatuses = before.map((guide) => `${guide.idGuia}:${guide.status}`);

    const saved = await saveRuleDraft(
      { document: withTightSessionLimit(document), notes: null },
      ADMIN,
      services.rules,
      services.access,
    );
    if (!saved.ok) throw new Error("rascunho não salvo");

    const impact = await previewRuleImpact(draftRuleSet(saved.value), {
      guides: services.guides,
      observationInterpreter: services.observationInterpreter,
    });

    expect(impact.evaluated).toBe(before.length);
    expect(impact.changes.length).toBeGreaterThan(0);
    expect(impact.unreadable).toBe(0);
    // A preview decides nothing: every stored decision is exactly as it was.
    const after = await services.guides.list({});
    expect(after.map((guide) => `${guide.idGuia}:${guide.status}`)).toEqual(beforeStatuses);
  });
});

describe("revalidating with the rules in force", () => {
  it("records new decisions and reports how many changed", async () => {
    const document = await publishSeed();
    await seedGuides();

    await saveRuleDraft(
      { document: withTightSessionLimit(document), notes: null },
      ADMIN,
      services.rules,
      services.access,
    );
    await publishRuleDraft(ADMIN, services.rules, services.access);

    // The services handed to the engine still carry the rule set loaded at
    // startup, so the test swaps in the published one exactly as a fresh
    // request would.
    const published = await services.rules.findPublished();
    if (published === null) throw new Error("sem versão publicada");

    const outcome = await revalidateGuides(ADMIN, {
      ...services,
      ruleSet: draftRuleSet(published),
    });

    if (!outcome.ok) throw new Error("reavaliação falhou");

    expect(outcome.value.evaluated).toBeGreaterThan(0);
    expect(outcome.value.changed).toBeGreaterThan(0);
    expect(outcome.value.rejected).toBe(0);

    const events = await services.access.listAuditEvents(10);
    expect(events.map((event) => event.action)).toContain("GUIDES_REVALIDATED");
  });
});
