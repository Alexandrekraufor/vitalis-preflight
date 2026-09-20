import "server-only";

import type { AccessRepository } from "@/application/ports/access-repository.port";
import type { GuideRepository } from "@/application/ports/guide-repository.port";
import type { ImportRepository } from "@/application/ports/import-repository.port";
import type { InvitationMailer } from "@/application/ports/invitation-mailer.port";
import type { RuleSet } from "@/domain/conventions/convention.types";
import type { ObservationInterpreter } from "@/domain/observations/observation-interpreter.port";
import { env, isProduction } from "@/lib/env";

import { db } from "./db/client";
import { createDrizzleAccessRepository } from "./db/repositories/drizzle-access.repository";
import { createDrizzleGuideRepository } from "./db/repositories/drizzle-guide.repository";
import { createDrizzleImportRepository } from "./db/repositories/drizzle-import.repository";
import { createAnthropicTextCompletionClient } from "./llm/anthropic-text-completion.client";
import { createConsoleInvitationMailer } from "./mail/console-invitation.mailer";
import { heuristicObservationInterpreter } from "./observations/heuristic-observation-interpreter";
import { createLlmObservationInterpreter } from "./observations/llm-observation-interpreter";
import { loadRuleSet } from "./rules/file-rule-set.repository";

export interface AppServices {
  readonly ruleSet: RuleSet;
  readonly observationInterpreter: ObservationInterpreter;
  readonly guides: GuideRepository;
  readonly imports: ImportRepository;
  readonly access: AccessRepository;
  readonly mailer: InvitationMailer;
}

function selectObservationInterpreter(): ObservationInterpreter {
  const configuration = env();

  if (configuration.OBSERVATION_INTERPRETER === "heuristic") {
    return heuristicObservationInterpreter;
  }

  const apiKey = configuration.ANTHROPIC_API_KEY;
  if (apiKey === undefined) return heuristicObservationInterpreter;

  return createLlmObservationInterpreter({
    client: createAnthropicTextCompletionClient({
      apiKey,
      model: configuration.OBSERVATION_LLM_MODEL,
    }),
  });
}

/**
 * The one place concrete implementations are chosen.
 *
 * Every server entry point — pages, REST routes, MCP tools, the seed script —
 * asks for services here, so swapping a repository, an interpreter or a mail
 * provider is a single-file change and no use case knows what it is talking to.
 */
export async function appServices(): Promise<AppServices> {
  const database = db();

  return {
    ruleSet: await loadRuleSet(),
    observationInterpreter: selectObservationInterpreter(),
    guides: createDrizzleGuideRepository(database),
    imports: createDrizzleImportRepository(database),
    access: createDrizzleAccessRepository(database),
    mailer: createConsoleInvitationMailer(isProduction()),
  };
}
