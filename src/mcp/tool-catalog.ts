import type { AppServices } from "@/infrastructure/composition-root";

import type { ToolInputShape, ToolOutputShape } from "./tool.types";
import { consultarGuiaTool } from "./tools/consultar-guia.tool";
import { consultarRegraConvenioTool } from "./tools/consultar-regra-convenio.tool";
import { resumoOperacionalTool } from "./tools/resumo-operacional.tool";
import { verificarGuiaTool } from "./tools/verificar-guia.tool";

/** A tool as documentation reads it: identity and contract, without the handler. */
export interface McpToolSummary {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: ToolInputShape;
  readonly outputSchema: ToolOutputShape;
  readonly readOnly: true;
}

/**
 * The published tools, described from the very definitions the server
 * registers.
 *
 * The documentation screen reads this instead of a hand-written list, so a
 * tool cannot be renamed, given a new argument or dropped without the page
 * following along. `tests/integration/mcp.test.ts` asserts that this catalogue
 * and the protocol's own `tools/list` agree.
 */
export function mcpToolCatalog(services: AppServices): readonly McpToolSummary[] {
  return [
    consultarRegraConvenioTool(services.ruleSet),
    verificarGuiaTool(services),
    consultarGuiaTool(services),
    resumoOperacionalTool(services),
  ].map((definition) => ({
    name: definition.name,
    title: definition.config.title,
    description: definition.config.description,
    inputSchema: definition.config.inputSchema,
    outputSchema: definition.config.outputSchema,
    readOnly: true,
  }));
}
