import { createHash, randomBytes } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  approveAuthorization,
  beginAuthorization,
  denyAuthorization,
  exchangeAuthorizationCode,
  refreshAccessToken,
  registerOAuthClient,
  type AuthorizationParams,
} from "@/application/access/oauth-authorization.use-case";
import type { AuthenticatedUser } from "@/domain/access/access.types";
import { MCP_SCOPE } from "@/domain/access/oauth";
import { oauthSecrets } from "@/infrastructure/auth/oauth-secrets";
import { bearer, createTestServices, type TestServices } from "@tests/fixtures/test-services";

let services: TestServices;

vi.mock("@/infrastructure/composition-root", () => ({
  appServices: () => Promise.resolve(services),
}));

const { POST: mcpRoute } = await import("@/app/mcp/route");
const { POST: registerRoute } = await import("@/app/oauth/register/route");
const { POST: tokenRoute } = await import("@/app/oauth/token/route");

const RESOURCE = "http://localhost:3000/mcp";
const REDIRECT_URI = "http://127.0.0.1:41234/callback";

/**
 * The person approving the consent has to exist and be active: the token is
 * only as good as the account behind it, which is what the last test proves.
 */
let USER: AuthenticatedUser;

function dependencies() {
  return {
    oauth: services.oauth,
    access: services.access,
    secrets: oauthSecrets,
    resource: RESOURCE,
  };
}

function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return {
    verifier,
    challenge: createHash("sha256").update(verifier, "ascii").digest("base64url"),
  };
}

async function registerClient(): Promise<string> {
  const registered = await registerOAuthClient(
    { name: "Claude Code", redirectUris: [REDIRECT_URI] },
    { oauth: services.oauth },
  );
  if (!registered.ok) throw new Error("registro falhou");
  return registered.value.id;
}

function authorizationParams(
  clientId: string,
  challenge: string,
  overrides: Partial<AuthorizationParams> = {},
): AuthorizationParams {
  return {
    clientId,
    redirectUri: REDIRECT_URI,
    responseType: "code",
    codeChallenge: challenge,
    codeChallengeMethod: "S256",
    scope: MCP_SCOPE,
    state: "estado-do-cliente",
    resource: RESOURCE,
    ...overrides,
  };
}

/** Runs the flow up to the code the client would receive on its redirect. */
async function authorizeToCode(): Promise<{
  clientId: string;
  code: string;
  verifier: string;
}> {
  const clientId = await registerClient();
  const { verifier, challenge } = pkce();

  const started = await beginAuthorization(
    authorizationParams(clientId, challenge),
    USER,
    dependencies(),
  );
  if (!started.ok) throw new Error(`autorização falhou: ${started.error}`);

  const approved = await approveAuthorization(started.value.id, USER, dependencies());
  if (!approved.ok) throw new Error("consentimento falhou");

  const redirect = new URL(approved.value.redirectTo);
  const code = redirect.searchParams.get("code");
  if (code === null) throw new Error("sem código no retorno");

  expect(redirect.searchParams.get("state")).toBe("estado-do-cliente");

  return { clientId, code, verifier };
}

function mcpRequest(token: string): Request {
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...bearer(token),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
}

function tokenRequest(body: Record<string, string>): Request {
  return new Request("http://localhost/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
}

beforeEach(async () => {
  services = createTestServices();
  USER = await services.access.createUser({
    email: "carla@clinicavitalis.test",
    name: "Carla",
    passwordHash: "argon2id$placeholder",
    role: "ADMIN",
  });
});

describe("dynamic client registration", () => {
  it("issues a client id without a secret", async () => {
    const response = await registerRoute(
      new Request("http://localhost/oauth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_name: "Claude Code",
          redirect_uris: [REDIRECT_URI],
        }),
      }),
    );

    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.client_id).toEqual(expect.any(String));
    expect(body.token_endpoint_auth_method).toBe("none");
    expect(body).not.toHaveProperty("client_secret");
  });

  it("refuses a redirect target that would carry the code in the clear", async () => {
    const response = await registerRoute(
      new Request("http://localhost/oauth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ redirect_uris: ["http://evil.example.com/callback"] }),
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_redirect_uri");
  });
});

describe("authorization", () => {
  it("refuses a client nobody registered", async () => {
    const { challenge } = pkce();
    const started = await beginAuthorization(
      authorizationParams("44444444-4444-4444-8444-444444444444", challenge),
      USER,
      dependencies(),
    );

    expect(started).toEqual({ ok: false, error: "UNKNOWN_CLIENT" });
  });

  it("refuses a redirect target the client did not register", async () => {
    const clientId = await registerClient();
    const { challenge } = pkce();

    const started = await beginAuthorization(
      authorizationParams(clientId, challenge, {
        redirectUri: "http://127.0.0.1:41234/callback/../outro",
      }),
      USER,
      dependencies(),
    );

    expect(started).toEqual({ ok: false, error: "INVALID_REDIRECT_URI" });
  });

  it("refuses a request without PKCE, and without plain challenges", async () => {
    const clientId = await registerClient();
    const { challenge } = pkce();

    const missing = await beginAuthorization(
      authorizationParams(clientId, challenge, { codeChallenge: null }),
      USER,
      dependencies(),
    );
    const plain = await beginAuthorization(
      authorizationParams(clientId, challenge, { codeChallengeMethod: "plain" }),
      USER,
      dependencies(),
    );

    expect(missing).toEqual({ ok: false, error: "PKCE_REQUIRED" });
    expect(plain).toEqual({ ok: false, error: "PKCE_REQUIRED" });
  });

  it("refuses a request aimed at another server", async () => {
    const clientId = await registerClient();
    const { challenge } = pkce();

    const started = await beginAuthorization(
      authorizationParams(clientId, challenge, { resource: "https://outra-clinica.test/mcp" }),
      USER,
      dependencies(),
    );

    expect(started).toEqual({ ok: false, error: "RESOURCE_MISMATCH" });
  });

  it("sends the person back with an error when they refuse", async () => {
    const clientId = await registerClient();
    const { challenge } = pkce();

    const started = await beginAuthorization(
      authorizationParams(clientId, challenge),
      USER,
      dependencies(),
    );
    if (!started.ok) throw new Error("autorização falhou");

    const denied = await denyAuthorization(started.value.id, USER, dependencies());
    if (!denied.ok) throw new Error("recusa falhou");

    const redirect = new URL(denied.value.redirectTo);
    expect(redirect.searchParams.get("error")).toBe("access_denied");
    expect(redirect.searchParams.get("code")).toBeNull();
  });

  it("keeps one person's pending consent out of another person's hands", async () => {
    const clientId = await registerClient();
    const { challenge } = pkce();

    const started = await beginAuthorization(
      authorizationParams(clientId, challenge),
      USER,
      dependencies(),
    );
    if (!started.ok) throw new Error("autorização falhou");

    const intruder: AuthenticatedUser = { ...USER, id: "55555555-5555-4555-8555-555555555555" };
    const stolen = await approveAuthorization(started.value.id, intruder, dependencies());

    expect(stolen).toEqual({ ok: false, error: "REQUEST_NOT_FOUND" });
  });
});

describe("token exchange", () => {
  it("issues a token the MCP endpoint accepts", async () => {
    const { clientId, code, verifier } = await authorizeToCode();

    const response = await tokenRoute(
      tokenRequest({
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const body = await response.json();
    expect(body.token_type).toBe("Bearer");
    expect(body.scope).toBe(MCP_SCOPE);

    const mcp = await mcpRoute(mcpRequest(body.access_token));
    expect(mcp.status).toBe(200);
  });

  it("refuses the wrong PKCE verifier", async () => {
    const { clientId, code } = await authorizeToCode();

    const response = await tokenRoute(
      tokenRequest({
        grant_type: "authorization_code",
        code,
        code_verifier: randomBytes(32).toString("base64url"),
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_grant");
  });

  it("burns the code on first use", async () => {
    const { clientId, code, verifier } = await authorizeToCode();
    const form = {
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
    };

    expect((await tokenRoute(tokenRequest(form))).status).toBe(200);
    expect((await tokenRoute(tokenRequest(form))).status).toBe(400);
  });

  it("refuses a code redeemed by a different client", async () => {
    const { code, verifier } = await authorizeToCode();
    const otherClient = await registerClient();

    const response = await tokenRoute(
      tokenRequest({
        grant_type: "authorization_code",
        code,
        code_verifier: verifier,
        client_id: otherClient,
        redirect_uri: REDIRECT_URI,
      }),
    );

    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe("invalid_client");
  });

  it("rotates the refresh token and retires the old grant", async () => {
    const { clientId, code, verifier } = await authorizeToCode();

    const first = await (
      await tokenRoute(
        tokenRequest({
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          client_id: clientId,
          redirect_uri: REDIRECT_URI,
        }),
      )
    ).json();

    const refreshed = await refreshAccessToken(
      { refreshToken: first.refresh_token, clientId },
      dependencies(),
    );
    if (!refreshed.ok) throw new Error("renovação falhou");

    // The new access token works and the previous pair is dead.
    expect((await mcpRoute(mcpRequest(refreshed.value.accessToken))).status).toBe(200);
    expect((await mcpRoute(mcpRequest(first.access_token))).status).toBe(401);

    const replay = await refreshAccessToken(
      { refreshToken: first.refresh_token, clientId },
      dependencies(),
    );
    expect(replay).toEqual({ ok: false, error: "INVALID_GRANT" });
  });
});

describe("the MCP endpoint under OAuth", () => {
  it("points an anonymous caller at the resource metadata", async () => {
    const response = await mcpRoute(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      "resource_metadata=",
    );
  });

  it("stops accepting a token once the person is disabled", async () => {
    const { clientId, code, verifier } = await authorizeToCode();

    const tokens = await exchangeAuthorizationCode(
      { code, codeVerifier: verifier, clientId, redirectUri: REDIRECT_URI },
      dependencies(),
    );
    if (!tokens.ok) throw new Error("troca falhou");

    expect((await mcpRoute(mcpRequest(tokens.value.accessToken))).status).toBe(200);

    await services.access.setUserStatus(USER.id, "DISABLED");

    expect((await mcpRoute(mcpRequest(tokens.value.accessToken))).status).toBe(401);
  });

  it("refuses a refresh token used as an access token", async () => {
    const { clientId, code, verifier } = await authorizeToCode();

    const tokens = await exchangeAuthorizationCode(
      { code, codeVerifier: verifier, clientId, redirectUri: REDIRECT_URI },
      dependencies(),
    );
    if (!tokens.ok) throw new Error("troca falhou");

    expect((await mcpRoute(mcpRequest(tokens.value.refreshToken))).status).toBe(401);
  });
});
