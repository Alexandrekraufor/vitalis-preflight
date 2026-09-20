import type { GuideStructuralIssue } from "@/domain/guides/guide";
import type { RawGuideRecord } from "@/domain/normalization/normalization.types";

import type {
  GuideRepository,
  PersistGuideOutcome,
} from "../ports/guide-repository.port";
import type {
  ImportRepository,
  ImportSource,
} from "../ports/import-repository.port";
import {
  validateGuide,
  type ValidateGuideDependencies,
  type ValidatedGuide,
} from "../guides/validate-guide.use-case";

export interface ImportGuidesDependencies extends ValidateGuideDependencies {
  readonly guides: GuideRepository;
  readonly imports: ImportRepository;
}

export interface ImportGuidesInput {
  readonly records: readonly RawGuideRecord[];
  readonly source: ImportSource;
  readonly fileName: string | null;
  readonly fileHash: string | null;
}

export interface RejectedRecord {
  /** 1-based position in the submitted batch. */
  readonly index: number;
  readonly idGuia: string | null;
  readonly issues: readonly GuideStructuralIssue[];
}

export interface ImportedRecord {
  readonly validated: ValidatedGuide;
  readonly persistence: PersistGuideOutcome;
}

export interface ImportGuidesOutput {
  readonly importId: string;
  readonly imported: readonly ImportedRecord[];
  readonly rejected: readonly RejectedRecord[];
  readonly newVersions: number;
  readonly automaticNormalizations: number;
}

function idOf(record: RawGuideRecord): string | null {
  const value = record.id_guia;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * The only write path into the system.
 *
 * A CSV upload, a seed run and a single guide posted to the API all go through
 * here, so provenance, versioning and validation behave identically no matter
 * where the data came from. Rows that cannot be parsed are reported, never
 * silently dropped, and never abort the rest of the batch.
 */
export async function importGuides(
  { records, source, fileName, fileHash }: ImportGuidesInput,
  dependencies: ImportGuidesDependencies,
): Promise<ImportGuidesOutput> {
  const { guides, imports } = dependencies;

  const importId = await imports.start({ source, fileName, fileHash });

  const imported: ImportedRecord[] = [];
  const rejected: RejectedRecord[] = [];

  for (const [offset, record] of records.entries()) {
    const validated = await validateGuide(record, dependencies);

    if (!validated.ok) {
      rejected.push({ index: offset + 1, idGuia: idOf(record), issues: validated.error });
      continue;
    }

    const persistence = await guides.save({
      raw: record,
      guide: validated.value.result.guide,
      normalizations: validated.value.normalizations,
      result: validated.value.result,
      startedAt: validated.value.startedAt,
      completedAt: validated.value.completedAt,
      sourceImportId: importId,
    });

    imported.push({ validated: validated.value, persistence });
  }

  await imports.finish({
    id: importId,
    rowsRead: records.length,
    rowsImported: imported.length,
    rowsRejected: rejected.length,
  });

  return {
    importId,
    imported,
    rejected,
    newVersions: imported.filter((item) => item.persistence.createdNewVersion).length,
    automaticNormalizations: imported.reduce(
      (total, item) => total + item.validated.normalizations.length,
      0,
    ),
  };
}
