import {
  MCP_SCOPE,
  SUPPORTED_CODE_CHALLENGE_METHODS,
} from "@/domain/access/oauth";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Authorization server metadata (RFC 8414).
 *
 * Everything a client needs to run the flow without being configured by hand:
 * where to register, where to send the person, where to redeem the code. Only
 * the authorization code grant is published, only with PKCE, and only for
 * public clients, which is the OAuth 2.1 shape the MCP specification asks for.
 */
export function GET(): Response {
  const issuer = env().APP_URL;
  const absolute = (path: string): string => new URL(path, issuer).toString();

  return Response.json(
    {
      issuer,
      authorization_endpoint: absolute("/oauth/authorize"),
      token_endpoint: absolute("/oauth/token"),
      registration_endpoint: absolute("/oauth/register"),
      scopes_supported: [MCP_SCOPE],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: [...SUPPORTED_CODE_CHALLENGE_METHODS],
      token_endpoint_auth_methods_supported: ["none"],
      service_documentation: absolute("/integracoes/documentacao"),
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
