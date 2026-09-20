import { beforeEach, describe, expect, it, vi } from "vitest";

import { issueApiCredential } from "@/application/access/manage-api-credentials.use-case";
import { publishRuleDraft, saveRuleDraft } from "@/application/rules/manage-rule-set.use-case";
import { revalidateGuides } from "@/application/rules/rule-impact.use-case";
import type { AuthenticatedUser } from "@/domain/access/access.types";
import { credentialHint } from "@/domain/access/api-credential";
import { hasRole } from "@/infrastructure/auth/guards";
import { generateToken, hashToken } from "@/infrastructure/auth/tokens";
import { bearer, createTestServices, type TestServices } from "@tests/fixtures/test-services";

let services: TestServices;

vi.mock("@/infrastructure/composition-root", () => ({
  appServices: () => Promise.resolve(services),
}));

const { GET: listGuidesRoute } = await import("@/app/api/v1/guides/route");
const { POST: ingestRoute } = await import("@/app/api/v1/guides/route");
const { POST: mcpRoute } = await import("@/app/mcp/route");

const EVALUATOR: AuthenticatedUser = {
  id: "77777777-7777-4777-8777-777777777777",
  email: "avaliacao@expert.test",
  name: "Avaliação",
  role: "EVALUATOR",
  status: "ACTIVE",
};

const ADMIN: AuthenticatedUser = { ...EVALUATOR, id: "88888888-8888-4888-8888-888888888888", role: "ADMIN" };

/** Provisions the evaluation credential the way the script does. */
async function provisionEvaluationKey(surface: "REST" | "MCP"): Promise<string> {
  const secret = generateToken();

  await services.access.upsertEvaluationCredential({
    name: `Avaliação - ${surface}`,
    surface,
    scopes: ["READ"],
    tokenHash: hashToken(secret),
    hint: credentialHint(secret),
    secret,
  });

  return secret;
}

beforeEach(() => {
  services = createTestServices();
});

describe("the evaluation account can see the product", () => {
  it("reads the guides API with the evaluation key", async () => {
    const secret = await provisionEvaluationKey("REST");

    const response = await listGuidesRoute(
      new Request("http://localhost/api/v1/guides", { headers: bearer(secret) }),
    );

    expect(response.status).toBe(200);
  });

  it("reaches the MCP tools with its own key", async () => {
    const secret = await provisionEvaluationKey("MCP");

    const response = await mcpRoute(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          ...bearer(secret),
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      }),
    );

    expect(response.status).toBe(200);
  });

  it("can read the evaluation credential back, which is what the panel shows", async () => {
    const secret = await provisionEvaluationKey("REST");
    const stored = await services.access.listEvaluationCredentials();

    expect(stored).toHaveLength(1);
    expect(stored[0]?.secret).toBe(secret);
    expect(stored[0]?.scopes).toEqual(["READ"]);
  });

  it("rotates instead of piling up when provisioned twice", async () => {
    const first = await provisionEvaluationKey("REST");
    const second = await provisionEvaluationKey("REST");

    const stored = await services.access.listEvaluationCredentials();

    expect(stored).toHaveLength(1);
    expect(stored[0]?.secret).toBe(second);
    expect(stored[0]?.secret).not.toBe(first);
  });
});

describe("the evaluation account cannot change anything", () => {
  it("is not an administrator, which is what every admin boundary checks", () => {
    expect(hasRole(EVALUATOR, ["ADMIN"])).toBe(false);
    expect(hasRole(EVALUATOR, ["ADMIN", "MEMBER"])).toBe(false);
    expect(hasRole(ADMIN, ["ADMIN"])).toBe(true);
  });

  it("cannot write through the API with its read key", async () => {
    const secret = await provisionEvaluationKey("REST");

    const response = await ingestRoute(
      new Request("http://localhost/api/v1/guides", {
        method: "POST",
        headers: { "content-type": "application/json", ...bearer(secret) },
        body: JSON.stringify({ id_guia: "G-EVAL-0001" }),
      }),
    );

    expect(response.status).toBe(403);
  });

  it("cannot issue credentials of its own", async () => {
    const issued = await issueApiCredential(
      { name: "minha chave", surface: "REST", scopes: ["WRITE"] },
      EVALUATOR,
      services.access,
      { generate: generateToken, hash: hashToken },
    );

    expect(issued).toEqual({ ok: false, error: "FORBIDDEN" });
  });

  it("cannot save, publish or revalidate rules", async () => {
    const saved = await saveRuleDraft(
      { document: { versao: "x", procedimentos: [], convenios: [] }, notes: null },
      EVALUATOR,
      services.rules,
      services.access,
    );
    const published = await publishRuleDraft(EVALUATOR, services.rules, services.access);
    const revalidated = await revalidateGuides(EVALUATOR, services);

    expect(saved).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(published).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(revalidated).toEqual({ ok: false, error: "FORBIDDEN" });
  });

  it("does not weaken the administrator path", async () => {
    const issued = await issueApiCredential(
      { name: "chave do admin", surface: "REST", scopes: ["READ"] },
      ADMIN,
      services.access,
      { generate: generateToken, hash: hashToken },
    );

    expect(issued.ok).toBe(true);
  });
});
