import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { importGuides } from "@/application/imports/import-guides.use-case";
import { parseGuideCsv } from "@/infrastructure/csv/guide-csv.parser";

import {
  issueApiCredential,
  listApiCredentials,
  revokeApiCredential,
} from "@/application/access/manage-api-credentials.use-case";
import type { AuthenticatedUser } from "@/domain/access/access.types";
import { generateToken, hashToken } from "@/infrastructure/auth/tokens";
import { aGuideRecord } from "@tests/fixtures/guide-record";
import { bearer, createTestServices, type TestServices } from "@tests/fixtures/test-services";

let services: TestServices;

vi.mock("@/infrastructure/composition-root", () => ({
  appServices: () => Promise.resolve(services),
}));

const { GET: listGuidesRoute } = await import("@/app/api/v1/guides/route");
const { POST: validateRoute } = await import("@/app/api/v1/guides/validate/route");
const { POST: mcpRoute } = await import("@/app/mcp/route");

const TOKENS = { generate: generateToken, hash: hashToken } as const;

const ADMIN: AuthenticatedUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "carla@clinicavitalis.test",
  name: "Carla",
  role: "ADMIN",
  status: "ACTIVE",
};

const MEMBER: AuthenticatedUser = { ...ADMIN, id: "22222222-2222-4222-8222-222222222222", role: "MEMBER" };

beforeEach(() => {
  services = createTestServices();
});

async function issue(
  surface: "REST" | "MCP",
  actor: AuthenticatedUser = ADMIN,
  scopes: readonly ("READ" | "WRITE")[] = ["READ"],
) {
  return issueApiCredential(
    { name: `chave ${surface}`, surface, scopes },
    actor,
    services.access,
    TOKENS,
  );
}

function guidesRequest(token: string): Request {
  return new Request("http://localhost/api/v1/guides", { headers: bearer(token) });
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

describe("credentials issued from the dashboard", () => {
  it("opens the surface they were issued for", async () => {
    const issued = await issue("REST");
    if (!issued.ok) throw new Error("emissão falhou");

    const response = await listGuidesRoute(guidesRequest(issued.value.token));

    expect(response.status).toBe(200);
  });

  it("does not open a surface they were not issued for", async () => {
    const issued = await issue("MCP");
    if (!issued.ok) throw new Error("emissão falhou");

    // An MCP key is not a REST key: the surface is part of what is verified.
    const rest = await listGuidesRoute(guidesRequest(issued.value.token));
    const mcp = await mcpRoute(mcpRequest(issued.value.token));

    expect(rest.status).toBe(401);
    expect(mcp.status).toBe(200);
  });

  it("stops working the moment it is revoked", async () => {
    const issued = await issue("REST");
    if (!issued.ok) throw new Error("emissão falhou");

    expect((await listGuidesRoute(guidesRequest(issued.value.token))).status).toBe(200);

    const revoked = await revokeApiCredential(issued.value.credential.id, ADMIN, services.access);
    expect(revoked.ok).toBe(true);

    expect((await listGuidesRoute(guidesRequest(issued.value.token))).status).toBe(401);
  });

  it("is stored as a digest, never in the clear", async () => {
    const issued = await issue("REST");
    if (!issued.ok) throw new Error("emissão falhou");

    const stored = await services.access.listApiCredentials();
    const serialized = JSON.stringify(stored);

    expect(serialized).not.toContain(issued.value.token);
    // The hint is short by design: enough to tell two keys apart, useless alone.
    expect(issued.value.token.startsWith(issued.value.credential.hint)).toBe(true);
    expect(issued.value.credential.hint.length).toBeLessThan(issued.value.token.length);
  });

  it("records the last use, so an unused key can be retired", async () => {
    const issued = await issue("REST");
    if (!issued.ok) throw new Error("emissão falhou");

    expect((await services.access.listApiCredentials()).at(0)?.lastUsedAt).toBeNull();

    await listGuidesRoute(guidesRequest(issued.value.token));

    expect((await services.access.listApiCredentials()).at(0)?.lastUsedAt).not.toBeNull();
  });

  it("still authenticates the validate endpoint", async () => {
    const issued = await issue("REST");
    if (!issued.ok) throw new Error("emissão falhou");

    const response = await validateRoute(
      new Request("http://localhost/api/v1/guides/validate", {
        method: "POST",
        headers: { "content-type": "application/json", ...bearer(issued.value.token) },
        body: JSON.stringify(aGuideRecord({ id_guia: "G-CRED-0001" })),
      }),
    );

    expect(response.status).toBe(200);
  });
});

describe("only administrators manage credentials", () => {
  it("refuses to issue for a member, even calling the use case directly", async () => {
    const issued = await issue("REST", MEMBER);

    expect(issued).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(await services.access.listApiCredentials()).toHaveLength(0);
  });

  it("refuses to revoke for a member", async () => {
    const issued = await issue("REST");
    if (!issued.ok) throw new Error("emissão falhou");

    const revoked = await revokeApiCredential(issued.value.credential.id, MEMBER, services.access);

    expect(revoked).toEqual({ ok: false, error: "FORBIDDEN" });
    expect((await services.access.listApiCredentials()).at(0)?.revokedAt).toBeNull();
  });

  it("shows a member nothing when listing", async () => {
    await issue("REST");

    expect(await listApiCredentials(MEMBER, services.access)).toHaveLength(0);
    expect(await listApiCredentials(ADMIN, services.access)).toHaveLength(1);
  });

  it("audits who issued and who revoked, without the secret", async () => {
    const issued = await issue("REST");
    if (!issued.ok) throw new Error("emissão falhou");
    await revokeApiCredential(issued.value.credential.id, ADMIN, services.access);

    const events = await services.access.listAuditEvents(10);
    const actions = events.map((event) => event.action);

    expect(actions).toContain("API_CREDENTIAL_ISSUED");
    expect(actions).toContain("API_CREDENTIAL_REVOKED");
    expect(JSON.stringify(events)).not.toContain(issued.value.token);
  });
});

describe("every call to a machine surface is logged", () => {
  const since = new Date(0);

  it("records an authorized call with the credential that made it", async () => {
    const issued = await issue("REST");
    if (!issued.ok) throw new Error("emissão falhou");

    await listGuidesRoute(guidesRequest(issued.value.token));

    const [event] = await services.usage.listRecent({ since, limit: 1 });

    expect(event).toMatchObject({
      surface: "REST",
      method: "GET",
      route: "/api/v1/guides",
      status: 200,
      outcome: "AUTHORIZED",
    });
    expect(event?.caller.kind).toBe("API_KEY");
  });

  it("records a refusal without inventing a caller", async () => {
    await listGuidesRoute(new Request("http://localhost/api/v1/guides"));

    const [event] = await services.usage.listRecent({ since, limit: 1 });

    expect(event).toMatchObject({ status: 401, outcome: "UNAUTHORIZED" });
    expect(event?.caller.kind).toBe("ANONYMOUS");
  });

  it("stores the route pattern, never the guide that was asked for", async () => {
    const issued = await issue("REST");
    if (!issued.ok) throw new Error("emissão falhou");

    await listGuidesRoute(
      new Request("http://localhost/api/v1/guides?search=G-2608-0028", {
        headers: bearer(issued.value.token),
      }),
    );

    const [event] = await services.usage.listRecent({ since, limit: 1 });

    expect(event?.route).toBe("/api/v1/guides");
    expect(JSON.stringify(event)).not.toContain("G-2608-0028");
  });
});

describe("the report endpoint answers for any slice", () => {
  // The report only says something once there are guides to report on.
  beforeEach(async () => {
    const contents = readFileSync(
      path.join(process.cwd(), "data", "source", "guias.csv"),
      "utf8",
    );
    const parsed = parseGuideCsv(contents);
    if (!parsed.ok) throw new Error(parsed.error.message);

    await importGuides(
      { records: parsed.value, source: "SEED", fileName: "guias.csv", fileHash: null },
      services,
    );
  });

  const reportsRoute = async (query: string, token: string): Promise<Response> => {
    const { GET } = await import("@/app/api/v1/reports/route");
    return GET(new Request(`http://localhost/api/v1/reports${query}`, { headers: bearer(token) }));
  };

  it("returns one report for the whole clinic", async () => {
    const issued = await issue("REST");
    if (!issued.ok) throw new Error("emissão falhou");

    const response = await reportsRoute("?days=30", issued.value.token);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.days).toBe(30);
    expect(body.scope).toEqual({ unit: null, convention: null });
  });

  it("returns an array with one report per unit when asked to group", async () => {
    const issued = await issue("REST");
    if (!issued.ok) throw new Error("emissão falhou");

    const response = await reportsRoute("?days=30&group_by=unit", issued.value.token);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.groupBy).toBe("unit");
    expect(Array.isArray(body.reports)).toBe(true);
    // Each entry says which slice it answers for, so the caller never has to
    // guess which report is which.
    for (const report of body.reports) {
      expect(report.scope.unit).toEqual(expect.any(String));
    }
  });

  it("refuses a unit that does not exist instead of answering for everything", async () => {
    const issued = await issue("REST");
    if (!issued.ok) throw new Error("emissão falhou");

    const response = await reportsRoute("?unit=Marte", issued.value.token);

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_PAYLOAD");
  });

  it("stays closed without a credential", async () => {
    const { GET } = await import("@/app/api/v1/reports/route");
    const response = await GET(new Request("http://localhost/api/v1/reports"));

    expect(response.status).toBe(401);
  });
});

describe("ingestion by API", () => {
  const ingest = async (payload: unknown, token: string): Promise<Response> => {
    const { POST } = await import("@/app/api/v1/guides/route");
    return POST(
      new Request("http://localhost/api/v1/guides", {
        method: "POST",
        headers: { "content-type": "application/json", ...bearer(token) },
        body: JSON.stringify(payload),
      }),
    );
  };

  it("accepts one guide and answers with its decision", async () => {
    const issued = await issue("REST", ADMIN, ["WRITE"]);
    if (!issued.ok) throw new Error("emissão falhou");

    const response = await ingest(
      aGuideRecord({ id_guia: "G-API-1001" }),
      issued.value.token,
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.received).toBe(1);
    expect(body.imported).toBe(1);
    expect(body.results[0].idGuia).toBe("G-API-1001");
    expect(body.results[0].status).toEqual(expect.any(String));

    // It really landed: the guide is readable afterwards.
    expect(await services.guides.list({ search: "G-API-1001" })).toHaveLength(1);
  });

  it("accepts an array and reports every decision", async () => {
    const issued = await issue("REST", ADMIN, ["WRITE"]);
    if (!issued.ok) throw new Error("emissão falhou");

    const response = await ingest(
      [
        aGuideRecord({ id_guia: "G-API-2001" }),
        aGuideRecord({ id_guia: "G-API-2002" }),
      ],
      issued.value.token,
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.imported).toBe(2);
    expect(body.results).toHaveLength(2);
  });

  it("reports the bad row and keeps the good ones", async () => {
    const issued = await issue("REST", ADMIN, ["WRITE"]);
    if (!issued.ok) throw new Error("emissão falhou");

    const response = await ingest(
      [aGuideRecord({ id_guia: "G-API-3001" }), { id_guia: "" }],
      issued.value.token,
    );
    const body = await response.json();

    // 207: part of the batch was accepted, part was not.
    expect(response.status).toBe(207);
    expect(body.imported).toBe(1);
    expect(body.rejected).toBe(1);
    expect(body.rejectedRecords[0].index).toBe(2);
  });

  it("versions by content instead of duplicating a resend", async () => {
    const issued = await issue("REST", ADMIN, ["WRITE"]);
    if (!issued.ok) throw new Error("emissão falhou");

    const guide = aGuideRecord({ id_guia: "G-API-4001" });
    await ingest(guide, issued.value.token);
    const again = await ingest(guide, issued.value.token);
    const body = await again.json();

    expect(body.results[0].createdNewVersion).toBe(false);
    expect(await services.guides.list({ search: "G-API-4001" })).toHaveLength(1);
  });

  it("refuses a read-only key with 403, not with 401", async () => {
    const readOnly = await issue("REST", ADMIN, ["READ"]);
    if (!readOnly.ok) throw new Error("emissão falhou");

    const response = await ingest(aGuideRecord({ id_guia: "G-API-5001" }), readOnly.value.token);

    expect(response.status).toBe(403);
    expect(await services.guides.list({ search: "G-API-5001" })).toHaveLength(0);
  });

  it("refuses a write key on the read endpoints", async () => {
    const writeOnly = await issue("REST", ADMIN, ["WRITE"]);
    if (!writeOnly.ok) throw new Error("emissão falhou");

    const response = await listGuidesRoute(guidesRequest(writeOnly.value.token));

    expect(response.status).toBe(403);
  });

  it("lets a key hold both powers", async () => {
    const both = await issue("REST", ADMIN, ["READ", "WRITE"]);
    if (!both.ok) throw new Error("emissão falhou");

    expect((await ingest(aGuideRecord({ id_guia: "G-API-6001" }), both.value.token)).status).toBe(
      201,
    );
    expect((await listGuidesRoute(guidesRequest(both.value.token))).status).toBe(200);
  });

  it("refuses something that is not a guide at all", async () => {
    const issued = await issue("REST", ADMIN, ["WRITE"]);
    if (!issued.ok) throw new Error("emissão falhou");

    const response = await ingest("isto não é uma guia", issued.value.token);

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_PAYLOAD");
  });
});
