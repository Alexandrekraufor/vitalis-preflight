import { findConvention, findProcedure } from "@/domain/conventions/convention";
import type { RuleSet } from "@/domain/conventions/convention.types";
import type { NormalizedGuide } from "@/domain/guides/guide.types";
import {
  decide,
  type ObservationAudit,
  type ValidationResult,
} from "@/domain/guides/validation-result";
import { reconcileObservation } from "@/domain/observations/reconcile-observation";

import type { Finding } from "./finding";
import {
  NO_SUPPLEMENTARY_DATA,
  type RuleContext,
  type SupplementaryGuideData,
} from "./rules.types";
import { DETERMINISTIC_VALIDATORS } from "./validators";

export interface RuleEngineInput {
  readonly guide: NormalizedGuide;
  readonly ruleSet: RuleSet;
  /** Present only when the guide carries a reception note. */
  readonly observation: ObservationAudit | null;
  readonly supplementary?: SupplementaryGuideData;
}

export function buildRuleContext(
  guide: NormalizedGuide,
  ruleSet: RuleSet,
  supplementary: SupplementaryGuideData = NO_SUPPLEMENTARY_DATA,
): RuleContext {
  return {
    guide,
    ruleSet,
    convention: findConvention(ruleSet, guide.conventionName),
    procedure: findProcedure(ruleSet, guide.procedureCode),
    supplementary,
  };
}

/**
 * The one place a guide becomes a decision.
 *
 * Deterministic rules run first and on their own; the note interpretation is
 * reconciled against them afterwards. The model therefore never sees a chance
 * to weaken a rule - it can only add context the rules could not see.
 */
export function runRuleEngine({
  guide,
  ruleSet,
  observation,
  supplementary = NO_SUPPLEMENTARY_DATA,
}: RuleEngineInput): ValidationResult {
  const context = buildRuleContext(guide, ruleSet, supplementary);

  const deterministicFindings: Finding[] = DETERMINISTIC_VALIDATORS.flatMap(
    (validate) => validate(context),
  );

  const observationFindings =
    observation === null
      ? []
      : reconcileObservation(observation.interpretation, context);

  const findings = [...deterministicFindings, ...observationFindings];

  return {
    guide,
    decision: decide(guide, findings),
    findings,
    rules: { version: ruleSet.version, hash: ruleSet.hash },
    observation,
  };
}
