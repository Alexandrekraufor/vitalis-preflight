import "server-only";

import { z } from "zod";

import type {
  TextCompletionClient,
  TextCompletionRequest,
} from "./text-completion.port";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

const responseSchema = z.object({
  content: z.array(z.object({ type: z.literal("text"), text: z.string() }).or(z.object({ type: z.string() }))),
});

export interface AnthropicClientOptions {
  readonly apiKey: string;
  readonly model: string;
}

/**
 * Minimal Messages API client. A full SDK would add a dependency for one HTTP
 * call, and this project only ever needs a single text completion.
 */
export function createAnthropicTextCompletionClient({
  apiKey,
  model,
}: AnthropicClientOptions): TextCompletionClient {
  return {
    model,
    async complete({ system, user, maxOutputTokens }: TextCompletionRequest): Promise<string> {
      const response = await fetch(ANTHROPIC_MESSAGES_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxOutputTokens,
          system,
          messages: [{ role: "user", content: user }],
        }),
      });

      if (!response.ok) {
        throw new Error(`Anthropic respondeu ${response.status}.`);
      }

      const parsed = responseSchema.parse(await response.json());
      const text = parsed.content
        .map((block) => ("text" in block ? block.text : ""))
        .join("");

      if (text.trim() === "") {
        throw new Error("Anthropic retornou uma resposta sem texto.");
      }

      return text;
    },
  };
}
