import { parseGuide } from "@/domain/guides/guide";
import type { ValidationResult } from "@/domain/guides/validation-result";
import type { RawGuideRecord } from "@/domain/normalization/normalization.types";
import type { ObservationAudit } from "@/domain/guides/validation-result";
import { runRuleEngine } from "@/domain/rules/rule-engine";
import { heuristicObservationInterpreter } from "@/infrastructure/observations/heuristic-observation-interpreter";

import { testRuleSet } from "./rule-set";

/**
 * Parse + interpret + run, exactly as the real use case does, so unit tests
 * exercise the same path production does.
 */
export async function validateRecord(raw: RawGuideRecord): Promise<ValidationResult> {
  const parsed = parseGuide(raw);
  if (!parsed.ok) {
    throw new Error(
      `Fixture inválida: ${parsed.error.map((issue) => `${issue.field}: ${issue.message}`).join("; ")}`,
    );
  }

  const note = parsed.value.guide.receptionNote;
  const observation: ObservationAudit | null =
    note === null
      ? null
      : {
          interpreter: heuristicObservationInterpreter.name,
          model: heuristicObservationInterpreter.model,
          interpretation: await heuristicObservationInterpreter.interpret(note),
        };

  return runRuleEngine({ guide: parsed.value.guide, ruleSet: testRuleSet, observation });
}

export function codesOf(result: ValidationResult): readonly string[] {
  return result.findings.map((finding) => finding.code);
}
