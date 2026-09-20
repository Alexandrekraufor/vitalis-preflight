import { createHash } from "node:crypto";

import type {
  GuideDetail,
  GuideExportRow,
  GuideListFilter,
  GuideListItem,
  GuideRepository,
  PersistGuideInput,
  PersistGuideOutcome,
  ValidationRunSummary,
} from "@/application/ports/guide-repository.port";
import type {
  FinishImportInput,
  ImportRecord,
  ImportRepository,
  StartImportInput,
} from "@/application/ports/import-repository.port";
import { toGuideRecord } from "@/domain/guides/guide";
import type { NormalizedGuide } from "@/domain/guides/guide.types";
import type {
  NormalizationChange,
  RawGuideRecord,
} from "@/domain/normalization/normalization.types";
import type { Finding } from "@/domain/rules/finding";
import { compareIsoDates } from "@/lib/dates";
import { ZERO } from "@/lib/money";

interface StoredVersion {
  readonly versionNumber: number;
  readonly contentHash: string;
  readonly guide: NormalizedGuide;
  readonly raw: RawGuideRecord;
  readonly normalizations: readonly NormalizationChange[];
}

interface StoredRun extends ValidationRunSummary {
  readonly findings: readonly Finding[];
}

interface StoredGuide {
  currentVersion: StoredVersion;
  runs: StoredRun[];
}

function firstActionableFinding(findings: readonly Finding[]): Finding | undefined {
  return findings.find((finding) => finding.severity !== "INFO");
}

/**
 * In-memory stand-in for the PostgreSQL repositories.
 *
 * It exists so the API and use-case tests exercise the real handlers without a
 * database, and it deliberately reproduces the behaviour the tests depend on -
 * content-hash versioning and run history - rather than pretending to store.
 */
export function createInMemoryGuideRepository(): GuideRepository {
  const store = new Map<string, StoredGuide>();

  function detailOf(stored: StoredGuide): GuideDetail | null {
    const latestRun = stored.runs.at(-1);
    if (latestRun === undefined) return null;

    return {
      guide: stored.currentVersion.guide,
      normalizations: stored.currentVersion.normalizations,
      latestRun,
      findings: latestRun.findings,
      history: [...stored.runs].reverse(),
    };
  }

  function matches(guide: NormalizedGuide, run: StoredRun, filter: GuideListFilter): boolean {
    if (filter.status !== undefined && run.decision !== filter.status) return false;
    if (filter.unit !== undefined && guide.unit !== filter.unit) return false;
    if (filter.conventionName !== undefined && guide.conventionName !== filter.conventionName) {
      return false;
    }
    if (filter.from !== undefined && compareIsoDates(guide.appointmentDate, filter.from) < 0) {
      return false;
    }
    if (
      filter.through !== undefined &&
      compareIsoDates(guide.appointmentDate, filter.through) > 0
    ) {
      return false;
    }
    if (filter.search !== undefined && filter.search.trim() !== "") {
      const needle = filter.search.trim().toLowerCase();
      const haystack = `${guide.idGuia} ${guide.patient}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  }

  function selected(filter: GuideListFilter): { guide: NormalizedGuide; run: StoredRun }[] {
    return [...store.values()]
      .map((stored) => ({ guide: stored.currentVersion.guide, run: stored.runs.at(-1) }))
      .filter(
        (entry): entry is { guide: NormalizedGuide; run: StoredRun } =>
          entry.run !== undefined && matches(entry.guide, entry.run, filter),
      );
  }

  return {
    save(input: PersistGuideInput): Promise<PersistGuideOutcome> {
      const record = toGuideRecord(input.guide);
      const contentHash = createHash("sha256").update(JSON.stringify(record)).digest("hex");
      const existing = store.get(input.guide.idGuia);
      const unchanged = existing?.currentVersion.contentHash === contentHash;

      const versionNumber = unchanged
        ? existing.currentVersion.versionNumber
        : (existing?.currentVersion.versionNumber ?? 0) + 1;

      const version: StoredVersion = {
        versionNumber,
        contentHash,
        guide: input.guide,
        raw: input.raw,
        normalizations: input.normalizations,
      };

      const run: StoredRun = {
        id: `run-${input.guide.idGuia}-${(existing?.runs.length ?? 0) + 1}`,
        decision: input.result.decision.status,
        decisionSummary: input.result.decision.summary,
        rulesVersion: input.result.rules.version,
        rulesHash: input.result.rules.hash,
        amountAtRisk: input.result.decision.amountAtRisk,
        observationInterpreter: input.result.observation?.interpreter ?? null,
        observationModel: input.result.observation?.model ?? null,
        completedAt: input.completedAt,
        versionNumber,
        findings: input.result.findings,
      };

      store.set(input.guide.idGuia, {
        currentVersion: version,
        runs: [...(existing?.runs ?? []), run],
      });

      return Promise.resolve({
        idGuia: input.guide.idGuia,
        createdNewVersion: !unchanged,
        versionNumber,
      });
    },

    list(filter: GuideListFilter): Promise<readonly GuideListItem[]> {
      const items = selected(filter).map(({ guide, run }): GuideListItem => {
        const primary = firstActionableFinding(run.findings);
        return {
          idGuia: guide.idGuia,
          unit: guide.unit,
          conventionName: guide.conventionName,
          patient: guide.patient,
          procedureCode: guide.procedureCode,
          procedureDescription: guide.procedureDescription,
          appointmentDate: guide.appointmentDate,
          amount: guide.amount,
          status: run.decision,
          amountAtRisk: run.amountAtRisk,
          primaryFindingCode: primary?.code ?? null,
          primaryFindingMessage: primary?.message ?? null,
          validatedAt: run.completedAt,
        };
      });

      return Promise.resolve(
        filter.limit === undefined ? items : items.slice(0, filter.limit),
      );
    },

    listRawRecords(): Promise<readonly RawGuideRecord[]> {
      return Promise.resolve(
        [...store.values()].map((stored) => stored.currentVersion.raw),
      );
    },

    findDetail(idGuia: string): Promise<GuideDetail | null> {
      const stored = store.get(idGuia);
      return Promise.resolve(stored === undefined ? null : detailOf(stored));
    },

    listForExport(filter: GuideListFilter): Promise<readonly GuideExportRow[]> {
      return Promise.resolve(
        selected(filter).map(({ guide, run }) => ({
          record: toGuideRecord(guide),
          status: run.decision,
          amountAtRisk: run.amountAtRisk ?? ZERO,
          findings: run.findings,
        })),
      );
    },
  };
}

export function createInMemoryImportRepository(): ImportRepository {
  const records = new Map<string, ImportRecord>();

  return {
    start({ source, fileName }: StartImportInput): Promise<string> {
      const id = `import-${records.size + 1}`;
      records.set(id, {
        id,
        source,
        fileName,
        rowsRead: 0,
        rowsImported: 0,
        rowsRejected: 0,
        createdAt: new Date(),
      });
      return Promise.resolve(id);
    },

    finish({ id, ...totals }: FinishImportInput): Promise<void> {
      const existing = records.get(id);
      if (existing !== undefined) records.set(id, { ...existing, ...totals });
      return Promise.resolve();
    },

    listRecent(limit: number): Promise<readonly ImportRecord[]> {
      return Promise.resolve([...records.values()].reverse().slice(0, limit));
    },
  };
}
