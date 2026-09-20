import type { AppServices } from "@/infrastructure/composition-root";
import { heuristicObservationInterpreter } from "@/infrastructure/observations/heuristic-observation-interpreter";

import {
  createInMemoryAccessRepository,
  createRecordingMailer,
  type RecordingMailer,
} from "./in-memory-access";
import { createInMemoryOAuthRepository } from "./in-memory-oauth";
import { createInMemoryRuleSetRepository } from "./in-memory-rule-sets";
import { createInMemoryApiUsageRepository } from "./in-memory-usage";
import {
  createInMemoryGuideRepository,
  createInMemoryImportRepository,
} from "./in-memory-repositories";
import { testRuleSet } from "./rule-set";

/**
 * A fully wired application with in-memory storage. API route tests point the
 * composition root at this, so they exercise the real handlers, the real use
 * cases and the real rules - only the database is substituted.
 */
export interface TestServices extends AppServices {
  readonly mailer: RecordingMailer;
}

export function createTestServices(): TestServices {
  return {
    ruleSet: testRuleSet,
    observationInterpreter: heuristicObservationInterpreter,
    guides: createInMemoryGuideRepository(),
    imports: createInMemoryImportRepository(),
    access: createInMemoryAccessRepository(),
    oauth: createInMemoryOAuthRepository(),
    usage: createInMemoryApiUsageRepository(),
    rules: createInMemoryRuleSetRepository(),
    mailer: createRecordingMailer(),
  };
}

/** Bearer header for the external integration API, as the tests send it. */
export const TEST_API_KEY = "test-rest-key-0000000000000000000000";
export const TEST_MCP_KEY = "test-mcp-key-00000000000000000000000";

export function bearer(key: string): Record<string, string> {
  return { authorization: `Bearer ${key}` };
}
