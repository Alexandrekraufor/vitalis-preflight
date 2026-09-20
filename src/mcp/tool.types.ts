import type { z } from "zod";

export type ToolInputShape = Record<string, z.ZodType>;
export type ToolOutputShape = Record<string, z.ZodType>;

export interface McpToolConfig<
  TInput extends ToolInputShape,
  TOutput extends ToolOutputShape,
> {
  readonly title: string;
  readonly description: string;
  readonly inputSchema: TInput;
  readonly outputSchema: TOutput;
  readonly annotations: { readonly readOnlyHint: true; readonly openWorldHint: false };
}

/**
 * A tool as this project defines it: a name, a config the SDK understands, and
 * a handler that returns the structured output its own schema describes.
 *
 * Every tool here is read-only - the preflight answers questions and validates,
 * it never edits a guide on an agent's behalf - which is why `annotations` is
 * narrowed to exactly that.
 */
/** Derived through `z.object` so optional fields stay optional for callers. */
export type ToolInput<TInput extends ToolInputShape> = z.infer<z.ZodObject<TInput>>;

/**
 * The structured payload a tool returns. Intersecting with an index signature
 * is what lets a generic shape satisfy the SDK's `structuredContent` type.
 */
export type ToolOutput<TOutput extends ToolOutputShape> = {
  [K in keyof TOutput]: z.infer<TOutput[K]>;
} & Record<string, unknown>;

export interface McpToolDefinition<
  TInput extends ToolInputShape,
  TOutput extends ToolOutputShape,
> {
  readonly name: string;
  readonly config: McpToolConfig<TInput, TOutput>;
  readonly handler: (input: ToolInput<TInput>) => Promise<ToolOutput<TOutput>>;
}
