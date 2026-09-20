import { toValidationReport } from "@/application/guides/validation-report";
import type { ImportGuidesOutput } from "@/application/imports/import-guides.use-case";
import type { RawGuideRecord } from "@/domain/normalization/normalization.types";

/** How many guides one call may carry. Beyond this, the CSV path exists. */
export const MAX_BATCH_SIZE = 500;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Accepts one guide or a batch of them.
 *
 * Integrators send whichever shape their side produces; a single object is
 * treated as a batch of one so the response shape never changes with the
 * request shape.
 */
export function toBatch(payload: unknown): readonly RawGuideRecord[] | null {
  if (isRecord(payload)) return [payload as RawGuideRecord];

  if (Array.isArray(payload) && payload.every(isRecord)) {
    return payload as readonly RawGuideRecord[];
  }

  return null;
}

/**
 * What an ingestion answers with: the decision for every guide that entered,
 * and the reason for every one that did not.
 *
 * Returning the decisions inline is what lets the calling system act right
 * away instead of polling for what it just sent.
 */
export function toIngestionPayload(outcome: ImportGuidesOutput, received: number) {
  return {
    importId: outcome.importId,
    received,
    imported: outcome.imported.length,
    rejected: outcome.rejected.length,
    newVersions: outcome.newVersions,
    normalizations: outcome.automaticNormalizations,
    results: outcome.imported.map((record) => ({
      ...toValidationReport(record.validated.result, record.validated.normalizations),
      versionNumber: record.persistence.versionNumber,
      createdNewVersion: record.persistence.createdNewVersion,
    })),
    rejectedRecords: outcome.rejected.map((record) => ({
      index: record.index,
      idGuia: record.idGuia,
      issues: record.issues,
    })),
  };
}
