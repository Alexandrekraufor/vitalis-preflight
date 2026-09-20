import { MCP_SCOPE } from "@/domain/access/oauth";
import { mcpResourceUrl } from "@/infrastructure/auth/oauth-secrets";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Protected resource metadata (RFC 9728).
 *
 * This is the first thing an MCP client reads after a 401: it says which
 * authorization server can issue tokens for this endpoint. The optional path
 * segments exist because clients append the resource path to the well-known
 * URL, and both spellings have to answer.
 */
export function GET(): Response {
  const issuer = env().APP_URL;

  return Response.json(
    {
      resource: mcpResourceUrl(),
      authorization_servers: [issuer],
      scopes_supported: [MCP_SCOPE],
      bearer_methods_supported: ["header"],
      resource_documentation: new URL("/integracoes/documentacao", issuer).toString(),
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
