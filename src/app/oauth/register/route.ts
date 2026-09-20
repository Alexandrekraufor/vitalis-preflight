import { z } from "zod";

import { registerOAuthClient } from "@/application/access/oauth-authorization.use-case";
import { appServices } from "@/infrastructure/composition-root";
import { clientKey, consumeRateLimit } from "@/lib/rate-limit";
import { MAX_JSON_BODY_BYTES, readBoundedText } from "@/lib/request-body";

export const dynamic = "force-dynamic";

/** Registration is unauthenticated by design, so it is the most throttled. */
const RATE_LIMIT = { limit: 10, windowMs: 60_000 } as const;

const registrationSchema = z.object({
  client_name: z.string().trim().min(1).max(120).optional(),
  redirect_uris: z.array(z.string().max(2048)).min(1).max(10),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
  token_endpoint_auth_method: z.string().optional(),
  scope: z.string().max(200).optional(),
});

function error(code: string, description: string, status: number): Response {
  return Response.json({ error: code, error_description: description }, { status });
}

/**
 * Dynamic client registration (RFC 7591).
 *
 * An MCP client that was only given a URL registers itself here and gets a
 * `client_id`. No secret is issued: these are public clients, and what proves
 * the redemption is the PKCE verifier, not a shared password sitting in a
 * config file on a laptop.
 */
export async function POST(request: Request): Promise<Response> {
  const throttle = consumeRateLimit(clientKey(request, "oauth-register"), RATE_LIMIT);
  if (!throttle.allowed) {
    return error("temporarily_unavailable", "Muitas tentativas. Aguarde um minuto.", 429);
  }

  const body = await readBoundedText(request, MAX_JSON_BODY_BYTES);
  if (!body.ok) return error("invalid_client_metadata", "Corpo inválido.", 400);

  let payload: unknown;
  try {
    payload = JSON.parse(body.value);
  } catch {
    return error("invalid_client_metadata", "O corpo não é um JSON válido.", 400);
  }

  const parsed = registrationSchema.safeParse(payload);
  if (!parsed.success) {
    return error("invalid_client_metadata", "Envie redirect_uris válidos.", 400);
  }

  const services = await appServices();
  const registered = await registerOAuthClient(
    {
      name: parsed.data.client_name ?? "Cliente MCP",
      redirectUris: parsed.data.redirect_uris,
    },
    { oauth: services.oauth },
  );

  if (!registered.ok) {
    return error(
      "invalid_redirect_uri",
      registered.error === "INVALID_REDIRECT_URI"
        ? "Use https, loopback ou um esquema próprio do aplicativo."
        : "Informe um nome de cliente válido.",
      400,
    );
  }

  const client = registered.value;

  return Response.json(
    {
      client_id: client.id,
      client_name: client.name,
      redirect_uris: client.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    },
    { status: 201 },
  );
}
