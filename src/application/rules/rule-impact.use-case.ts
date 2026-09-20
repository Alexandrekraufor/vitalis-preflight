import type { AuthenticatedUser } from "@/domain/access/access.types";
import type { RuleSet } from "@/domain/conventions/convention.types";
import { guideStatusLabel, type GuideStatus } from "@/domain/guides/guide-status";
import { fromCents, type Money } from "@/lib/money";
import { err, ok, type Result } from "@/lib/result";

import { validateGuide } from "../guides/validate-guide.use-case";
import { importGuides } from "../imports/import-guides.use-case";
import type { AccessRepository } from "../ports/access-repository.port";
import type { GuideRepository } from "../ports/guide-repository.port";
import type { ImportRepository } from "../ports/import-repository.port";
import type { ObservationInterpreter } from "@/domain/observations/observation-interpreter.port";

export interface DecisionChange {
  readonly idGuia: string;
  readonly from: GuideStatus;
  readonly to: GuideStatus;
  readonly fromLabel: string;
  readonly toLabel: string;
}

export interface RuleImpact {
  readonly evaluated: number;
  /** Guides the rules could no longer read at all, which is a red flag. */
  readonly unreadable: number;
  readonly changes: readonly DecisionChange[];
  readonly amountAtRiskBefore: Money;
  readonly amountAtRiskAfter: Money;
}

export interface ImpactDependencies {
  readonly guides: GuideRepository;
  readonly observationInterpreter: ObservationInterpreter;
}

/**
 * What a rule set would decide, without deciding it.
 *
 * The draft is run over the payloads exactly as they arrived, and the result
 * is compared with the decision on record. Nothing is written: this is the
 * answer to "o que muda se eu publicar", which is the question anybody should
 * have answered before publishing.
 */
export async function previewRuleImpact(
  ruleSet: RuleSet,
  { guides, observationInterpreter }: ImpactDependencies,
): Promise<RuleImpact> {
  const [records, current] = await Promise.all([guides.listRawRecords(), guides.list({})]);
  const before = new Map(current.map((item) => [item.idGuia, item]));

  const changes: DecisionChange[] = [];
  let unreadable = 0;
  let amountAtRiskAfter = 0;

  for (const record of records) {
    const validated = await validateGuide(record, { ruleSet, observationInterpreter });

    if (!validated.ok) {
      unreadable += 1;
      continue;
    }

    const { decision, guide } = validated.value.result;
    amountAtRiskAfter += decision.amountAtRisk;

    const previous = before.get(guide.idGuia);
    if (previous !== undefined && previous.status !== decision.status) {
      changes.push({
        idGuia: guide.idGuia,
        from: previous.status,
        to: decision.status,
        fromLabel: guideStatusLabel(previous.status),
        toLabel: guideStatusLabel(decision.status),
      });
    }
  }

  return {
    evaluated: records.length,
    unreadable,
    changes,
    amountAtRiskBefore: fromCents(
      current.reduce((total, item) => total + item.amountAtRisk, 0),
    ),
    amountAtRiskAfter: fromCents(amountAtRiskAfter),
  };
}

export interface RevalidationOutcome {
  readonly evaluated: number;
  readonly changed: number;
  readonly rejected: number;
}

export interface RevalidationDependencies extends ImpactDependencies {
  readonly ruleSet: RuleSet;
  readonly imports: ImportRepository;
  readonly access: AccessRepository;
}

/**
 * Re-runs the engine over every stored guide with the rules in force.
 *
 * It goes through the same ingestion path everything else uses, so each guide
 * gets a new validation run and the previous ones stay in the history: a
 * decision is never rewritten, it is superseded, and the audit says by whom.
 */
export async function revalidateGuides(
  actor: AuthenticatedUser,
  dependencies: RevalidationDependencies,
): Promise<Result<RevalidationOutcome, "FORBIDDEN">> {
  if (actor.role !== "ADMIN") return err("FORBIDDEN");

  const { guides, access, ruleSet } = dependencies;
  const [records, current] = await Promise.all([guides.listRawRecords(), guides.list({})]);
  const before = new Map(current.map((item) => [item.idGuia, item.status]));

  const outcome = await importGuides(
    { records, source: "REVALIDATION", fileName: null, fileHash: null },
    dependencies,
  );

  const changed = outcome.imported.filter((record) => {
    const previous = before.get(record.validated.result.guide.idGuia);
    return previous !== undefined && previous !== record.validated.result.decision.status;
  }).length;

  await access.recordAuditEvent({
    action: "GUIDES_REVALIDATED",
    actorKind: "SESSION",
    actorUserId: actor.id,
    subject: outcome.importId,
    metadata: {
      version: ruleSet.version,
      hash: ruleSet.hash,
      evaluated: outcome.imported.length,
      changed,
    },
  });

  return ok({
    evaluated: outcome.imported.length,
    changed,
    rejected: outcome.rejected.length,
  });
}
