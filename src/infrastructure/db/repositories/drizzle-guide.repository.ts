import "server-only";

import { createHash } from "node:crypto";

import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";

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
import { parseGuide, toGuideRecord } from "@/domain/guides/guide";
import type {
  NormalizationChange,
  RawGuideRecord,
  NormalizedGuideRecord,
} from "@/domain/normalization/normalization.types";
import type { Finding } from "@/domain/rules/finding";
import type { FindingCode } from "@/domain/rules/finding-codes";
import { toIsoDate, type IsoDate } from "@/lib/dates";
import { parseMoney, toDecimalString, ZERO, type Money } from "@/lib/money";

import type { Database } from "../client";
import { guideVersions, guides } from "../schema/guides";
import { validationFindings, validationRuns } from "../schema/validations";

function hashOf(payload: NormalizedGuideRecord): string {
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}

function requireIsoDate(value: string): IsoDate {
  const date = toIsoDate(value);
  if (date === null) throw new Error(`Data inválida no banco: ${value}`);
  return date;
}

function moneyOrNull(value: string | null): Money | null {
  return value === null ? null : parseMoney(value);
}

function moneyOrZero(value: string | null): Money {
  return moneyOrNull(value) ?? ZERO;
}

/**
 * Guides, their versions and their validation history, backed by PostgreSQL.
 *
 * Writes happen in one transaction so a stored decision can never point at a
 * version that was not stored, which is the whole premise of the audit trail.
 */
export function createDrizzleGuideRepository(database: Database): GuideRepository {
  return {
    async save(input: PersistGuideInput): Promise<PersistGuideOutcome> {
      const payload = toGuideRecord(input.guide);
      const contentHash = hashOf(payload);

      return database.transaction(async (tx) => {
        const [existingGuide] = await tx
          .select({ currentVersionId: guides.currentVersionId })
          .from(guides)
          .where(eq(guides.idGuia, input.guide.idGuia))
          .limit(1);

        const [currentVersion] =
          existingGuide === undefined
            ? []
            : await tx
                .select({
                  id: guideVersions.id,
                  versionNumber: guideVersions.versionNumber,
                  contentHash: guideVersions.contentHash,
                })
                .from(guideVersions)
                .where(eq(guideVersions.id, existingGuide.currentVersionId))
                .limit(1);

        const unchanged = currentVersion?.contentHash === contentHash;

        let versionId = currentVersion?.id ?? "";
        let versionNumber = currentVersion?.versionNumber ?? 0;

        if (!unchanged) {
          versionNumber += 1;
          const [inserted] = await tx
            .insert(guideVersions)
            .values({
              idGuia: input.guide.idGuia,
              versionNumber,
              contentHash,
              rawPayload: input.raw,
              normalizedPayload: payload,
              normalizationChanges: input.normalizations,
              sourceImportId: input.sourceImportId,
            })
            .returning({ id: guideVersions.id });

          if (inserted === undefined) throw new Error("Falha ao gravar a versão da guia.");
          versionId = inserted.id;
        }

        const guideRow = {
          currentVersionId: versionId,
          unit: input.guide.unit,
          appointmentDate: input.guide.appointmentDate,
          patient: input.guide.patient,
          conventionName: input.guide.conventionName,
          procedureCode: input.guide.procedureCode,
          procedureDescription: input.guide.procedureDescription,
          professional: input.guide.professional,
          amount: input.guide.amount === null ? null : toDecimalString(input.guide.amount),
          receptionNote: input.guide.receptionNote,
          enteredAt: input.guide.enteredAt,
          updatedAt: new Date(),
        };

        await tx
          .insert(guides)
          .values({ idGuia: input.guide.idGuia, ...guideRow })
          .onConflictDoUpdate({ target: guides.idGuia, set: guideRow });

        const [run] = await tx
          .insert(validationRuns)
          .values({
            idGuia: input.guide.idGuia,
            guideVersionId: versionId,
            rulesVersion: input.result.rules.version,
            rulesHash: input.result.rules.hash,
            decision: input.result.decision.status,
            decisionSummary: input.result.decision.summary,
            amountAtRisk: toDecimalString(input.result.decision.amountAtRisk),
            observationInterpreter: input.result.observation?.interpreter ?? null,
            observationModel: input.result.observation?.model ?? null,
            observationInterpretation: input.result.observation?.interpretation ?? null,
            startedAt: input.startedAt,
            completedAt: input.completedAt,
          })
          .returning({ id: validationRuns.id });

        if (run === undefined) throw new Error("Falha ao gravar a validação da guia.");

        if (input.result.findings.length > 0) {
          await tx.insert(validationFindings).values(
            input.result.findings.map((finding, position) => ({
              validationRunId: run.id,
              position,
              code: finding.code,
              severity: finding.severity,
              source: finding.source,
              field: finding.field,
              message: finding.message,
              expected: finding.expected,
              actual: finding.actual,
              evidence: finding.evidence,
              recommendedAction: finding.recommendedAction,
            })),
          );
        }

        await tx
          .update(guides)
          .set({ latestValidationRunId: run.id })
          .where(eq(guides.idGuia, input.guide.idGuia));

        return {
          idGuia: input.guide.idGuia,
          createdNewVersion: !unchanged,
          versionNumber,
        };
      });
    },

    async list(filter: GuideListFilter): Promise<readonly GuideListItem[]> {
      const conditions = [
        filter.status === undefined ? undefined : eq(validationRuns.decision, filter.status),
        filter.unit === undefined ? undefined : eq(guides.unit, filter.unit),
        filter.conventionName === undefined
          ? undefined
          : eq(guides.conventionName, filter.conventionName),
        filter.from === undefined ? undefined : gte(guides.appointmentDate, filter.from),
        filter.through === undefined ? undefined : lte(guides.appointmentDate, filter.through),
        filter.search === undefined || filter.search.trim() === ""
          ? undefined
          : or(
              ilike(guides.idGuia, `%${filter.search.trim()}%`),
              ilike(guides.patient, `%${filter.search.trim()}%`),
            ),
      ].filter((condition) => condition !== undefined);

      const rows = await database
        .select({
          idGuia: guides.idGuia,
          unit: guides.unit,
          conventionName: guides.conventionName,
          patient: guides.patient,
          procedureCode: guides.procedureCode,
          procedureDescription: guides.procedureDescription,
          appointmentDate: guides.appointmentDate,
          amount: guides.amount,
          runId: validationRuns.id,
          decision: validationRuns.decision,
          amountAtRisk: validationRuns.amountAtRisk,
          completedAt: validationRuns.completedAt,
        })
        .from(guides)
        .innerJoin(validationRuns, eq(guides.latestValidationRunId, validationRuns.id))
        .where(conditions.length === 0 ? undefined : and(...conditions))
        .orderBy(desc(guides.appointmentDate), guides.idGuia)
        .limit(filter.limit ?? 1000);

      const primaryFindings = await loadPrimaryFindings(
        database,
        rows.map((row) => row.runId),
      );

      return rows.map((row) => {
        const primary = primaryFindings.get(row.runId) ?? null;
        return {
          idGuia: row.idGuia,
          unit: row.unit,
          conventionName: row.conventionName,
          patient: row.patient,
          procedureCode: row.procedureCode,
          procedureDescription: row.procedureDescription,
          appointmentDate: requireIsoDate(row.appointmentDate),
          amount: moneyOrNull(row.amount),
          status: row.decision,
          amountAtRisk: moneyOrZero(row.amountAtRisk),
          primaryFindingCode: primary?.code ?? null,
          primaryFindingMessage: primary?.message ?? null,
          validatedAt: row.completedAt,
        };
      });
    },

    async findDetail(idGuia: string): Promise<GuideDetail | null> {
      const [row] = await database
        .select({
          normalizedPayload: guideVersions.normalizedPayload,
          normalizationChanges: guideVersions.normalizationChanges,
          latestRunId: guides.latestValidationRunId,
        })
        .from(guides)
        .innerJoin(guideVersions, eq(guides.currentVersionId, guideVersions.id))
        .where(eq(guides.idGuia, idGuia))
        .limit(1);

      if (row === undefined || row.latestRunId === null) return null;

      const parsed = parseGuide(row.normalizedPayload);
      if (!parsed.ok) {
        throw new Error(
          `A versão gravada da guia ${idGuia} não satisfaz o contrato atual de guias.`,
        );
      }

      const history = await loadRunHistory(database, idGuia);
      const latestRun = history.find((run) => run.id === row.latestRunId);
      if (latestRun === undefined) return null;

      const findings = await loadFindings(database, row.latestRunId);

      return {
        guide: parsed.value.guide,
        normalizations: row.normalizationChanges as readonly NormalizationChange[],
        latestRun,
        findings,
        history,
      };
    },

    async listRawRecords(): Promise<readonly RawGuideRecord[]> {
      const rows = await database
        .select({ raw: guideVersions.rawPayload })
        .from(guides)
        .innerJoin(guideVersions, eq(guides.currentVersionId, guideVersions.id))
        .orderBy(guides.idGuia);

      return rows.map((row) => row.raw);
    },

    async listForExport(filter: GuideListFilter): Promise<readonly GuideExportRow[]> {
      const rows = await database
        .select({
          record: guideVersions.normalizedPayload,
          decision: validationRuns.decision,
          amountAtRisk: validationRuns.amountAtRisk,
          runId: validationRuns.id,
        })
        .from(guides)
        .innerJoin(guideVersions, eq(guides.currentVersionId, guideVersions.id))
        .innerJoin(validationRuns, eq(guides.latestValidationRunId, validationRuns.id))
        .where(
          filter.status === undefined
            ? undefined
            : eq(validationRuns.decision, filter.status),
        )
        .orderBy(guides.idGuia);

      const findingsByRun = await loadFindingsByRun(
        database,
        rows.map((row) => row.runId),
      );

      return rows.map((row) => ({
        record: row.record,
        status: row.decision,
        amountAtRisk: moneyOrZero(row.amountAtRisk),
        findings: findingsByRun.get(row.runId) ?? [],
      }));
    },
  };
}

async function loadFindingsByRun(
  database: Database,
  runIds: readonly string[],
): Promise<Map<string, Finding[]>> {
  if (runIds.length === 0) return new Map();

  const rows = await database
    .select()
    .from(validationFindings)
    .where(inArray(validationFindings.validationRunId, [...runIds]))
    .orderBy(validationFindings.validationRunId, validationFindings.position);

  const byRun = new Map<string, Finding[]>();
  for (const row of rows) {
    const existing = byRun.get(row.validationRunId) ?? [];
    existing.push(toFinding(row));
    byRun.set(row.validationRunId, existing);
  }
  return byRun;
}

async function loadRunHistory(
  database: Database,
  idGuia: string,
): Promise<readonly ValidationRunSummary[]> {
  const rows = await database
    .select({
      id: validationRuns.id,
      decision: validationRuns.decision,
      decisionSummary: validationRuns.decisionSummary,
      rulesVersion: validationRuns.rulesVersion,
      rulesHash: validationRuns.rulesHash,
      amountAtRisk: validationRuns.amountAtRisk,
      observationInterpreter: validationRuns.observationInterpreter,
      observationModel: validationRuns.observationModel,
      completedAt: validationRuns.completedAt,
      versionNumber: guideVersions.versionNumber,
    })
    .from(validationRuns)
    .innerJoin(guideVersions, eq(validationRuns.guideVersionId, guideVersions.id))
    .where(eq(validationRuns.idGuia, idGuia))
    .orderBy(desc(validationRuns.completedAt));

  return rows.map((row) => ({
    ...row,
    decision: row.decision,
    amountAtRisk: moneyOrZero(row.amountAtRisk),
  }));
}

async function loadFindings(
  database: Database,
  runId: string,
): Promise<readonly Finding[]> {
  const rows = await database
    .select()
    .from(validationFindings)
    .where(eq(validationFindings.validationRunId, runId))
    .orderBy(validationFindings.position);

  return rows.map(toFinding);
}

/**
 * The finding that explains the decision: the first non-informational one, in
 * engine order. Fetched for the whole page in a single round trip rather than
 * per row.
 */
async function loadPrimaryFindings(
  database: Database,
  runIds: readonly string[],
): Promise<Map<string, { code: string; message: string }>> {
  if (runIds.length === 0) return new Map();

  const rows = await database
    .select({
      validationRunId: validationFindings.validationRunId,
      code: validationFindings.code,
      message: validationFindings.message,
      position: validationFindings.position,
    })
    .from(validationFindings)
    .where(
      and(
        inArray(validationFindings.validationRunId, [...runIds]),
        sql`${validationFindings.severity} <> 'INFO'`,
      ),
    )
    .orderBy(validationFindings.validationRunId, validationFindings.position);

  const primary = new Map<string, { code: string; message: string }>();
  for (const row of rows) {
    if (primary.has(row.validationRunId)) continue;
    primary.set(row.validationRunId, { code: row.code, message: row.message });
  }
  return primary;
}

function toFinding(row: typeof validationFindings.$inferSelect): Finding {
  return {
    // `code` and `field` are stored as text so that adding a finding code is
    // not a schema migration; the enum columns come back already narrowed.
    code: row.code as FindingCode,
    severity: row.severity,
    source: row.source,
    field: row.field as Finding["field"],
    message: row.message,
    expected: row.expected,
    actual: row.actual,
    evidence: row.evidence,
    recommendedAction: row.recommendedAction,
  };
}
