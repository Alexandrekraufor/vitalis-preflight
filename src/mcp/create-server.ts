import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import type { AppServices } from "@/infrastructure/composition-root";

import { consultarGuiaTool } from "./tools/consultar-guia.tool";
import { consultarRegraConvenioTool } from "./tools/consultar-regra-convenio.tool";
import { resumoOperacionalTool } from "./tools/resumo-operacional.tool";
import { verificarGuiaTool } from "./tools/verificar-guia.tool";

const SERVER_INFO = {
  name: "vitalis-preflight",
  version: "1.0.0",
  title: "Vitalis Preflight",
} as const;

const INSTRUCTIONS = `Este servidor expõe a validação preventiva de guias de convênio da Clínica Vitalis.

As regras dos convênios são a única fonte da verdade e vivem neste servidor: consulte-as com consultar_regra_convenio em vez de assumir qualquer regra.
Para saber se uma guia pode ser enviada, use verificar_guia - ela executa o mesmo motor determinístico da aplicação web.
Nenhuma tool altera guias. O servidor nunca inventa código de procedimento, CID ou número de autorização.`;

/**
 * Structured output is the contract; the mirrored text block is there for
 * clients that still read `content` only.
 */
function toCallToolResult(structuredContent: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

/**
 * A fresh MCP server per request.
 *
 * Every tool delegates to the same use cases the web application and the REST
 * API call, so an agent and a person always get the same answer about the same
 * guide. All four tools are read-only.
 *
 * Tools are registered one by one rather than through a loop: the SDK infers a
 * tool's argument type from its own input schema, and that inference only works
 * when each schema is visible at the call site.
 */
export function createMcpServer(services: AppServices): McpServer {
  const server = new McpServer(SERVER_INFO, {
    capabilities: { tools: {} },
    instructions: INSTRUCTIONS,
  });

  const regraConvenio = consultarRegraConvenioTool(services.ruleSet);
  server.registerTool(regraConvenio.name, regraConvenio.config, async (input) =>
    toCallToolResult(await regraConvenio.handler(input)),
  );

  const verificarGuia = verificarGuiaTool(services);
  server.registerTool(verificarGuia.name, verificarGuia.config, async (input) =>
    toCallToolResult(await verificarGuia.handler(input)),
  );

  const consultarGuia = consultarGuiaTool(services);
  server.registerTool(consultarGuia.name, consultarGuia.config, async (input) =>
    toCallToolResult(await consultarGuia.handler(input)),
  );

  const resumoOperacional = resumoOperacionalTool(services);
  server.registerTool(resumoOperacional.name, resumoOperacional.config, async (input) =>
    toCallToolResult(await resumoOperacional.handler(input)),
  );

  return server;
}
