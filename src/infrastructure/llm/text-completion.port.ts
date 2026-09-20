export interface TextCompletionRequest {
  readonly system: string;
  readonly user: string;
  readonly maxOutputTokens: number;
}

/**
 * The only thing the application asks of a language model: text in, text out.
 *
 * Keeping the port this small is what stops a provider from leaking into the
 * domain — swapping vendors is implementing one method.
 */
export interface TextCompletionClient {
  readonly model: string;
  complete(request: TextCompletionRequest): Promise<string>;
}
