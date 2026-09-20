/**
 * Lifecycle of a rule set.
 *
 * Only one version is `PUBLISHED` at a time and only one `DRAFT` exists at a
 * time; everything else is history that decisions still point at.
 */
export const RULE_SET_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export type RuleSetStatus = (typeof RULE_SET_STATUSES)[number];

const LABELS: Readonly<Record<RuleSetStatus, string>> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Vigente",
  ARCHIVED: "Arquivada",
};

export function ruleSetStatusLabel(status: RuleSetStatus): string {
  return LABELS[status];
}
