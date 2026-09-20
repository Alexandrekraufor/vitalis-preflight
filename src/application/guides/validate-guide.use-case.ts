import type { RuleSet } from "@/domain/conventions/convention.types";
import { parseGuide, type GuideStructuralIssue } from "@/domain/guides/guide";
import type { ObservationAudit, ValidationResult } from "@/domain/guides/validation-result";
import type { ObservationInterpreter } from "@/domain/observations/observation-interpreter.port";
import type {
  NormalizationChange,
  RawGuideRecord,
} from "@/domain/normalization/normalization.types";
import { runRuleEngine } from "@/domain/rules/rule-engine";
import type { SupplementaryGuideData } from "@/domain/rules/rules.types";
import { err, ok, type Result } from "@/lib/result";

export interface ValidateGuideDependencies {
  readonly ruleSet: RuleSet;
  readonly observationInterpreter: ObservationInterpreter;
}

export interface ValidatedGuide {
  readonly result: ValidationResult;
  readonly normalizations: readonly NormalizationChange[];
  readonly startedAt: Date;
  readonly completedAt: Date;
}

export interface ValidateGuideOptions {
  readonly supplementary?: SupplementaryGuideData;
}

/**
 * Normalize, parse, interpret the note, run the rules.
 *
 * This is the single implementation of "validate a guide". The CSV import, the
 * REST endpoint and the MCP tools all call it; none of them re-implements any
 * part of it, which is what keeps the three channels from drifting apart.
 */
export async function validateGuide(
  raw: RawGuideRecord,
  { ruleSet, observationInterpreter }: ValidateGuideDependencies,
  options: ValidateGuideOptions = {},
): Promise<Result<ValidatedGuide, readonly GuideStructuralIssue[]>> {
  const startedAt = new Date();
  const parsed = parseGuide(raw);

  if (!parsed.ok) return err(parsed.error);

  const { guide, normalizations } = parsed.value;

  const observation: ObservationAudit | null =
    guide.receptionNote === null
      ? null
      : {
          interpreter: observationInterpreter.name,
          model: observationInterpreter.model,
          interpretation: await observationInterpreter.interpret(guide.receptionNote),
        };

  const result = runRuleEngine({
    guide,
    ruleSet,
    observation,
    ...(options.supplementary === undefined
      ? {}
      : { supplementary: options.supplementary }),
  });

  return ok({ result, normalizations, startedAt, completedAt: new Date() });
}
