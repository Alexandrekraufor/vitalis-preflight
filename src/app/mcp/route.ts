import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { guardMachineRequest } from "@/infrastructure/auth/api-guard";
import { appServices } from "@/infrastructure/composition-root";
import { createMcpServer } from "@/mcp/create-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Remote MCP endpoint over Streamable HTTP, stateless.
 *
 * The transport speaks Web `Request`/`Response`, which is exactly what a
 * Next.js route handler receives and returns — no adapter in between.
 *
 * Every tool behind this endpoint is read/validate only. A valid credential
 * buys the ability to ask questions, never to change a guide.
 */
async function handle(request: Request): Promise<Response> {
  // Authentication happens before the SDK sees the request, so an unauthorized
  // caller never reaches tool discovery: they cannot even learn which tools
  // exist, let alone call one.
  const denied = guardMachineRequest(request, "MCP");
  if (denied !== null) return denied;

  const services = await appServices();
  const server = createMcpServer(services);
  // Omitting `sessionIdGenerator` is what selects stateless mode in the SDK:
  // no session is created, nothing is kept between requests, and any instance
  // behind a load balancer can serve any call.
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } finally {
    await transport.close();
    await server.close();
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
