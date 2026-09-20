import type { ClinicUnit, NormalizedGuide } from "@/domain/guides/guide.types";
import type { GuideStatus } from "@/domain/guides/guide-status";
import type { ValidationResult } from "@/domain/guides/validation-result";
import type {
  NormalizationChange,
  NormalizedGuideRecord,
  RawGuideRecord,
} from "@/domain/normalization/normalization.types";
import type { Finding } from "@/domain/rules/finding";
import type { IsoDate } from "@/lib/dates";
import type { Money } from "@/lib/money";

export interface PersistGuideInput {
  readonly raw: RawGuideRecord;
  readonly guide: NormalizedGuide;
  readonly normalizations: readonly NormalizationChange[];
  readonly result: ValidationResult;
  readonly startedAt: Date;
  readonly completedAt: Date;
  /** `null` for guides that arrived one at a time through the API. */
  readonly sourceImportId: string | null;
}

export interface PersistGuideOutcome {
  readonly idGuia: string;
  /** `false` when the incoming payload matched the stored version byte for byte. */
  readonly createdNewVersion: boolean;
  readonly versionNumber: number;
}

/** One row of the guides table, as every list and report reads it. */
export interface GuideListItem {
  readonly idGuia: string;
  readonly unit: ClinicUnit;
  readonly conventionName: string;
  readonly patient: string;
  readonly procedureCode: string;
  readonly procedureDescription: string | null;
  readonly appointmentDate: IsoDate;
  readonly amount: Money | null;
  readonly status: GuideStatus;
  readonly amountAtRisk: Money;
  /** The finding that best explains the decision — the first non-informational one. */
  readonly primaryFindingCode: string | null;
  readonly primaryFindingMessage: string | null;
  readonly validatedAt: Date;
}

export interface GuideListFilter {
  readonly status?: GuideStatus;
  readonly unit?: ClinicUnit;
  readonly conventionName?: string;
  /** Matches the guide id or the patient code. */
  readonly search?: string;
  readonly limit?: number;
}

export interface ValidationRunSummary {
  readonly id: string;
  readonly decision: GuideStatus;
  readonly decisionSummary: string;
  readonly rulesVersion: string;
  readonly rulesHash: string;
  readonly amountAtRisk: Money;
  readonly observationInterpreter: string | null;
  readonly observationModel: string | null;
  readonly completedAt: Date;
  readonly versionNumber: number;
}

export interface GuideDetail {
  readonly guide: NormalizedGuide;
  readonly normalizations: readonly NormalizationChange[];
  readonly latestRun: ValidationRunSummary;
  readonly findings: readonly Finding[];
  readonly history: readonly ValidationRunSummary[];
}

/** A guide with everything an export needs: the original columns and its findings. */
export interface GuideExportRow {
  readonly record: NormalizedGuideRecord;
  readonly status: GuideStatus;
  readonly amountAtRisk: Money;
  readonly findings: readonly Finding[];
}

/**
 * Persistence boundary for guides and their validation history. They are one
 * aggregate — a decision only means anything next to the version of the data it
 * was made on — so they share a repository instead of being split by table.
 */
export interface GuideRepository {
  save(input: PersistGuideInput): Promise<PersistGuideOutcome>;
  list(filter: GuideListFilter): Promise<readonly GuideListItem[]>;
  findDetail(idGuia: string): Promise<GuideDetail | null>;
  listForExport(filter: GuideListFilter): Promise<readonly GuideExportRow[]>;
}
