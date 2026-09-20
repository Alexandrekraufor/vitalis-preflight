import { readFileSync } from "node:fs";
import path from "node:path";

import type { RuleSet } from "@/domain/conventions/convention.types";
import { ruleSetFromJson } from "@/infrastructure/rules/file-rule-set.repository";

const RULE_FILE = path.join(process.cwd(), "data", "source", "regras_convenio.json");

/** The real rule file - tests assert against the rules the app actually ships. */
export const testRuleSet: RuleSet = ruleSetFromJson(readFileSync(RULE_FILE, "utf8"));
