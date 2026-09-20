import {
  exchangeAuthorizationCode,
  refreshAccessToken,
  type TokenFailure,
  type TokenSet,
} from "@/application/access/oauth-authorization.use-case";
import { oauthDependencies } from "@/infrastructure/auth/oauth-secrets";
import { appServices } from "@/infrastructure/composition-root";
import { clientKey, consumeRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE_LIMIT = { limit: 60, windowMs: 60_000 } as const;

const STATUS_BY_FAILURE: Readonly<Record<TokenFailure, number>> = {
  INVALID_GRANT: 400,
  INVALID_CLIENT: 401,
  INVALID_REQUEST: 400,
  UNSUPPORTED_GRANT_TYPE: 400,
};

const OAUTH_ERROR: Readonly<Record<TokenFailure, string>> = {
  INVALID_GRANT: "invalid_grant",
  INVALID_CLIENT: "invalid_client",
  INVALID_REQUEST: "invalid_request",
  UNSUPPORTED_GRANT_TYPE: "unsupported_grant_type",
};

function failure(reason: TokenFailure): Response {
  // The body says which rule was broken and nothing about which token exists:
  // an attacker learns the same thing from every wrong guess.
  return Response.json(
    { error: OAUTH_ERROR[reason] },
    { status: STATUS_BY_FAILURE[reason], headers: { "cache-control": "no-store" } },
  );
}

function issued(tokens: TokenSet): Response {
  return Response.json(
    {
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.expiresInSeconds,
      refresh_token: tokens.refreshToken,
      scope: tokens.scope,
    },
    { headers: { "cache-control": "no-store", pragma: "no-cache" } },
  );
}

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * The token endpoint.
 *
 * Two grants, both for public clients: an authorization code proved with its
 * PKCE verifier, and a refresh token that is rotated on every use. Nothing
 * here trusts `client_id` on its own; it only has to match what the grant was
 * issued to.
 */
export async function POST(request: Request): Promise<Response> {
  const throttle = consumeRateLimit(clientKey(request, "oauth-token"), RATE_LIMIT);
  if (!throttle.allowed) return failure("INVALID_REQUEST");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return failure("INVALID_REQUEST");
  }

  const services = await appServices();
  const dependencies = oauthDependencies(services);
  const grantType = field(form, "grant_type");

  if (grantType === "authorization_code") {
    const exchanged = await exchangeAuthorizationCode(
      {
        code: field(form, "code"),
        codeVerifier: field(form, "code_verifier"),
        clientId: field(form, "client_id"),
        redirectUri: field(form, "redirect_uri"),
      },
      dependencies,
    );

    return exchanged.ok ? issued(exchanged.value) : failure(exchanged.error);
  }

  if (grantType === "refresh_token") {
    const refreshed = await refreshAccessToken(
      { refreshToken: field(form, "refresh_token"), clientId: field(form, "client_id") },
      dependencies,
    );

    return refreshed.ok ? issued(refreshed.value) : failure(refreshed.error);
  }

  return failure("UNSUPPORTED_GRANT_TYPE");
}
