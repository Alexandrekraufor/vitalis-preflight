import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GuideExportRow } from "@/application/ports/guide-repository.port";
import { exportPendingGuidesCsv } from "@/infrastructure/csv/guide-csv.exporter";
import { fromCents } from "@/lib/money";
import { MAX_CSV_BYTES, MAX_JSON_BODY_BYTES } from "@/lib/request-body";
import { aGuideRecord } from "@tests/fixtures/guide-record";
import { signIn } from "@tests/fixtures/sessions";
import {
  bearer,
  createTestServices,
  TEST_API_KEY,
  TEST_MCP_KEY,
  type TestServices,
} from "@tests/fixtures/test-services";

let services: TestServices;

vi.mock("@/infrastructure/composition-root", () => ({
  appServices: () => Promise.resolve(services),
}));

const { POST: validate } = await import("@/app/api/v1/guides/validate/route");
const { GET: listGuides } = await import("@/app/api/v1/guides/route");
const { GET: getGuide } = await import("@/app/api/v1/guides/[id]/route");
const { GET: weeklyReport } = await import("@/app/api/v1/reports/weekly/route");
const { POST: mcp } = await import("@/app/mcp/route");
const { POST: importCsv } = await import("@/app/api/internal/imports/csv/route");

beforeEach(() => {
  services = createTestServices();
});

function validateRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/v1/guides/validate", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(aGuideRecord({ id_guia: "G-AUTH-0001" })),
  });
}

describe("external REST API requires a credential", () => {
  it("answers 401 to validate without a Bearer token", async () => {
    const response = await validate(validateRequest());

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Bearer");
  });

  it("answers 401 to a wrong Bearer token", async () => {
    const response = await validate(validateRequest(bearer("nao-e-a-chave-certa-mesmo")));

    expect(response.status).toBe(401);
  });

  it("answers 401 on every read endpoint without a credential", async () => {
    const [list, detail, report] = await Promise.all([
      listGuides(new Request("http://localhost/api/v1/guides")),
      getGuide(new Request("http://localhost/api/v1/guides/G-1"), {
        params: Promise.resolve({ id: "G-1" }),
      }),
      weeklyReport(new Request("http://localhost/api/v1/reports/weekly")),
    ]);

    expect([list.status, detail.status, report.status]).toEqual([401, 401, 401]);
  });

  it("says nothing about whether a key is configured", async () => {
    const response = await validate(validateRequest());
    const body = await response.text();

    expect(body).not.toContain("VITALIS_API_KEY");
    expect(body).not.toContain(TEST_API_KEY);
  });

  it("accepts the configured credential", async () => {
    const response = await validate(validateRequest(bearer(TEST_API_KEY)));

    expect(response.status).toBe(200);
  });

  it("does not accept the MCP credential on the REST surface", async () => {
    const response = await validate(validateRequest(bearer(TEST_MCP_KEY)));

    expect(response.status).toBe(401);
  });
});

describe("MCP endpoint requires a credential", () => {
  function mcpRequest(headers: Record<string, string> = {}): Request {
    return new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...headers,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    });
  }

  it("answers 401 without a Bearer token", async () => {
    const response = await mcp(mcpRequest());

    expect(response.status).toBe(401);
  });

  it("does not reveal the tool list to an unauthorized caller", async () => {
    const body = await (await mcp(mcpRequest())).text();

    expect(body).not.toContain("verificar_guia");
    expect(body).not.toContain("consultar_regra_convenio");
  });

  it("does not accept the REST credential on the MCP surface", async () => {
    const response = await mcp(mcpRequest(bearer(TEST_API_KEY)));

    expect(response.status).toBe(401);
  });

  it("exposes only read-only tools to an authorized caller", async () => {
    await mcp(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          ...bearer(TEST_MCP_KEY),
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0.0" },
          },
        }),
      }),
    );

    const response = await mcp(mcpRequest(bearer(TEST_MCP_KEY)));
    const body = await response.json();
    const tools: { name: string; annotations: { readOnlyHint: boolean } }[] =
      body.result.tools;

    expect(tools.map((tool) => tool.name).toSorted()).toEqual([
      "consultar_guia",
      "consultar_regra_convenio",
      "resumo_operacional",
      "verificar_guia",
    ]);

    // No tool that edits, approves, deletes or corrects anything exists at all,
    // and every one that does exist declares itself read-only.
    for (const tool of tools) {
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.name).not.toMatch(/editar|excluir|corrigir|aprovar|alterar|criar|enviar/);
    }
  });
});

describe("input limits", () => {
  it("rejects a JSON body past the ceiling", async () => {
    const oversized = JSON.stringify({
      ...aGuideRecord({ id_guia: "G-BIG" }),
      observacao_recepcao: "a".repeat(MAX_JSON_BODY_BYTES + 1),
    });

    const response = await validate(
      new Request("http://localhost/api/v1/guides/validate", {
        method: "POST",
        headers: { "content-type": "application/json", ...bearer(TEST_API_KEY) },
        body: oversized,
      }),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PAYLOAD_TOO_LARGE" },
    });
  });

  it("rejects a CSV upload past the ceiling", async () => {
    const member = await signIn(services.access, "MEMBER");
    const form = new FormData();
    form.set(
      "file",
      new File(["x".repeat(MAX_CSV_BYTES + 1)], "grande.csv", { type: "text/csv" }),
    );

    const response = await importCsv(
      new Request("http://localhost/api/internal/imports/csv", {
        method: "POST",
        body: form,
        headers: member.cookie,
      }),
    );

    expect(response.status).toBe(413);
  });

  it("ignores unexpected properties instead of trusting them", async () => {
    const response = await validate(
      new Request("http://localhost/api/v1/guides/validate", {
        method: "POST",
        headers: { "content-type": "application/json", ...bearer(TEST_API_KEY) },
        body: JSON.stringify({
          ...aGuideRecord({ id_guia: "G-EXTRA" }),
          role: "ADMIN",
          status: "READY_TO_SUBMIT",
          canSubmit: true,
          __proto__: { polluted: true },
        }),
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ idGuia: "G-EXTRA", status: "READY_TO_SUBMIT" });
    expect(body).not.toHaveProperty("role");
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });
});

describe("CSV export is inert in a spreadsheet", () => {
  function rowWithNote(note: string): GuideExportRow {
    return {
      record: {
        ...aGuideRecord({ id_guia: "G-CSV-1" }),
        observacao_recepcao: note,
      } as GuideExportRow["record"],
      status: "NEEDS_CORRECTION",
      amountAtRisk: fromCents(6200),
      findings: [
        {
          code: "CID_MISSING",
          severity: "BLOCKING",
          source: "CONVENTION_RULE",
          field: "cid",
          message: note,
          expected: null,
          actual: null,
          evidence: null,
          recommendedAction: "Preencher.",
        },
      ],
    };
  }

  it.each(["=CMD('calc')", "+1+1", "-2+3", "@SUM(A1)"])(
    "neutralizes a cell starting with %j",
    (payload) => {
      const csv = exportPendingGuidesCsv([rowWithNote(payload)]);

      // The value is still readable, but the leading apostrophe stops Excel and
      // Sheets from ever evaluating it.
      expect(csv).toContain(`'${payload}`);
      expect(csv).not.toMatch(new RegExp(`(^|,|")${payload.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m"));
    },
  );
});
