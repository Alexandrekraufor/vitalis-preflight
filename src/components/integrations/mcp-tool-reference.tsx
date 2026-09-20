import { z } from "zod";

import { CodeSample } from "@/components/ui/code-sample";
import type { McpToolSummary } from "@/mcp/tool-catalog";
import type { ToolInputShape, ToolOutputShape } from "@/mcp/tool.types";

interface SchemaField {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly description: string | null;
}

interface JsonSchemaProperty {
  readonly type?: string | readonly string[];
  readonly description?: string;
  readonly enum?: readonly unknown[];
  readonly anyOf?: readonly JsonSchemaProperty[];
  readonly items?: JsonSchemaProperty;
}

interface JsonSchemaObject {
  readonly properties?: Readonly<Record<string, JsonSchemaProperty>>;
  readonly required?: readonly string[];
}

/**
 * Renders a JSON Schema type the way a reader of the documentation thinks
 * about it - `string`, `string[]`, `"a" | "b"` - instead of echoing the raw
 * keywords.
 */
function describeType(property: JsonSchemaProperty): string {
  if (property.enum !== undefined) {
    return property.enum.map((value) => JSON.stringify(value)).join(" | ");
  }

  if (property.anyOf !== undefined) {
    return property.anyOf.map(describeType).join(" | ");
  }

  if (property.type === "array") {
    return property.items === undefined ? "array" : `${describeType(property.items)}[]`;
  }

  if (Array.isArray(property.type)) return property.type.join(" | ");

  return typeof property.type === "string" ? property.type : "object";
}

/**
 * Reads the tool's own Zod schema and turns it into a field table.
 *
 * The documentation cannot drift from the contract because it is generated
 * from the contract: this is the same schema the MCP SDK publishes in
 * `tools/list`.
 */
function toSchemaFields(shape: ToolInputShape | ToolOutputShape): readonly SchemaField[] {
  const schema = z.toJSONSchema(z.object(shape), { io: "input" }) as JsonSchemaObject;
  const required = new Set(schema.required ?? []);

  return Object.entries(schema.properties ?? {}).map(([name, property]) => ({
    name,
    type: describeType(property),
    required: required.has(name),
    description: property.description ?? null,
  }));
}

function FieldTable({
  title,
  fields,
  withRequired,
}: {
  readonly title: string;
  readonly fields: readonly SchemaField[];
  readonly withRequired: boolean;
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{title}</h4>
      {fields.length === 0 ? (
        <p className="mt-2 text-sm text-ink-muted">Sem argumentos.</p>
      ) : (
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-muted">
              <th className="py-1.5 pr-3 font-medium">Campo</th>
              <th className="py-1.5 pr-3 font-medium">Tipo</th>
              {withRequired && <th className="py-1.5 pr-3 font-medium">Obrigatório</th>}
              <th className="py-1.5 font-medium">Descrição</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field.name} className="border-t border-border-subtle align-top">
                <td className="py-2 pr-3 font-mono text-xs text-ink">{field.name}</td>
                <td className="py-2 pr-3 font-mono text-xs text-ink-muted">{field.type}</td>
                {withRequired && (
                  <td className="py-2 pr-3 text-xs text-ink-muted">
                    {field.required ? "sim" : "não"}
                  </td>
                )}
                <td className="py-2 text-sm text-ink-muted">{field.description ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function callExample(tool: McpToolSummary, fields: readonly SchemaField[]): string {
  const example: Record<string, string> = {};
  for (const field of fields.filter((candidate) => candidate.required)) {
    example[field.name] = "…";
  }

  return JSON.stringify(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: tool.name, arguments: example },
    },
    null,
    2,
  );
}

/** One tool, described from its registered definition. */
export function McpToolReference({ tool }: { readonly tool: McpToolSummary }) {
  const input = toSchemaFields(tool.inputSchema);
  const output = toSchemaFields(tool.outputSchema);

  return (
    <section
      id={tool.name}
      className="scroll-mt-24 rounded-[var(--radius-card)] border border-border-subtle bg-surface"
    >
      <header className="border-b border-border-subtle px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <code className="font-mono text-sm font-semibold text-ink">{tool.name}</code>
          <span className="rounded-full bg-ready-soft px-2 py-0.5 text-[0.6875rem] font-medium text-ready">
            somente leitura
          </span>
        </div>
        <p className="mt-2 text-sm font-medium text-ink">{tool.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{tool.description}</p>
      </header>

      <div className="flex flex-col gap-5 px-5 py-4">
        <FieldTable title="Entrada" fields={input} withRequired />
        <FieldTable title="Saída" fields={output} withRequired={false} />
        <CodeSample caption="Chamada JSON-RPC" language="json" code={callExample(tool, input)} />
      </div>
    </section>
  );
}

/** Compact card used on the Integrações screen, before the full reference. */
export function McpToolRow({ tool }: { readonly tool: McpToolSummary }) {
  return (
    <div className="flex flex-col gap-1.5 border-b border-border-subtle px-5 py-3.5 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <code className="font-mono text-sm text-ink">{tool.name}</code>
        <span className="rounded-full bg-ready-soft px-2 py-0.5 text-[0.6875rem] font-medium text-ready">
          somente leitura
        </span>
      </div>
      <p className="text-sm text-ink-muted">{tool.title}</p>
    </div>
  );
}
