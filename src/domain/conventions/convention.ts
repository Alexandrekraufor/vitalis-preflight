import type { Convention, Procedure, RuleSet } from "./convention.types";

/**
 * Conventions are written by humans ("Saúde Interior", "SAUDE INTERIOR"), so
 * lookups are accent- and case-insensitive. This normalizes the *key only* —
 * the guide keeps whatever the receptionist typed.
 */
export function conventionKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function findConvention(ruleSet: RuleSet, name: string): Convention | null {
  return ruleSet.conventions.get(conventionKey(name)) ?? null;
}

export function findProcedure(ruleSet: RuleSet, code: string): Procedure | null {
  return ruleSet.procedures.get(code.trim()) ?? null;
}

export function coversProcedure(convention: Convention, code: string): boolean {
  return convention.coveredProcedureCodes.includes(code.trim());
}
