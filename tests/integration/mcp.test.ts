import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { importGuides } from "@/application/imports/import-guides.use-case";
import type { AppServices } from "@/infrastructure/composition-root";
import { parseGuideCsv } from "@/infrastructure/csv/guide-csv.parser";
import { consultarGuiaTool } from "@/mcp/tools/consultar-guia.tool";
import { consultarRegraConvenioTool } from "@/mcp/tools/consultar-regra-convenio.tool";
import { resumoOperacionalTool } from "@/mcp/tools/resumo-operacional.tool";
import { verificarGuiaTool } from "@/mcp/tools/verificar-guia.tool";
import { aGuideRecord } from "@tests/fixtures/guide-record";
import { bearer, createTestServices, TEST_MCP_KEY } from "@tests/fixtures/test-services";

let services: AppServices;

vi.mock("@/infrastructure/composition-root", () => ({
  appServices: () => Promise.resolve(services),
}));

const { POST: mcpEndpoint } = await import("@/app/mcp/route");

const DATASET = readFileSync(path.join(process.cwd(), "data", "source", "guias.csv"), "utf8");

async function seed(): Promise<void> {
  const parsed = parseGuideCsv(DATASET);
  if (!parsed.ok) throw new Error(parsed.error.message);
  await importGuides(
    { records: parsed.value, source: "SEED", fileName: "guias.csv", fileHash: null },
    services,
  );
}

describe("consultar_regra_convenio", () => {
  beforeEach(() => {
    services = createTestServices();
  });

  it("answers with the real rule for a covered procedure", async () => {
    const tool = consultarRegraConvenioTool(services.ruleSet);

    await expect(
      tool.handler({ convenio: "Vitalcard", procedimento_codigo: "50000470" }),
    ).resolves.toMatchObject({
      convenio: "Vitalcard",
      coberto: true,
      procedimento: { valorReferencia: 62 },
      limiteSessoesPorAutorizacao: 10,
      prazoEnvioDias: 30,
      camposObrigatorios: expect.arrayContaining(["cid"]),
      versaoDasRegras: "agosto/2026",
    });
  });

  it("says a procedure is not covered without softening it", async () => {
    const tool = consultarRegraConvenioTool(services.ruleSet);

    await expect(
      tool.handler({ convenio: "Plano Bem", procedimento_codigo: "20103301" }),
    ).resolves.toMatchObject({
      coberto: false,
      observacaoDaRegra: expect.stringContaining("Não cobre consulta médica"),
    });
  });

  it("reports an unknown convention instead of inventing one", async () => {
    const tool = consultarRegraConvenioTool(services.ruleSet);

    await expect(
      tool.handler({ convenio: "Convênio Inexistente", procedimento_codigo: "50000470" }),
    ).resolves.toMatchObject({
      convenio: null,
      convenioConhecido: false,
      coberto: null,
      camposObrigatorios: [],
    });
  });
});

describe("verificar_guia", () => {
  beforeEach(() => {
    services = createTestServices();
  });

  it("validates a guide sent inline", async () => {
    const tool = verificarGuiaTool(services);

    await expect(
      tool.handler({ guia: aGuideRecord({ id_guia: "G-MCP-1" }) }),
    ).resolves.toMatchObject({
      idGuia: "G-MCP-1",
      status: "READY_TO_SUBMIT",
      podeEnviar: true,
      erro: null,
    });
  });

  it("explains why a guide cannot be submitted", async () => {
    const tool = verificarGuiaTool(services);

    const result = await tool.handler({
      guia: aGuideRecord({ id_guia: "G-MCP-2", data_atendimento: "2026-09-10" }),
    });

    expect(result).toMatchObject({ status: "NEEDS_CORRECTION", podeEnviar: false });
    expect(result.porQueCaiu.join(" ")).toContain("autorização venceu");
    expect(result.acoesRecomendadas.length).toBeGreaterThan(0);
  });

  it("validates a stored guide by id", async () => {
    await seed();
    const tool = verificarGuiaTool(services);

    await expect(tool.handler({ id_guia: "G-2608-0039" })).resolves.toMatchObject({
      idGuia: "G-2608-0039",
      status: "REVIEW_REQUIRED",
      podeEnviar: false,
    });
  });

  it("returns a readable error instead of throwing on a broken guide", async () => {
    const tool = verificarGuiaTool(services);

    const result = await tool.handler({
      guia: aGuideRecord({ id_guia: "G-MCP-3", data_atendimento: "31/02/2026" }),
    });

    expect(result.erro).toContain("data_atendimento");
    expect(result.podeEnviar).toBe(false);
  });

  it("requires at least one of guia or id_guia", async () => {
    const tool = verificarGuiaTool(services);

    await expect(tool.handler({})).resolves.toMatchObject({
      erro: expect.stringContaining("id_guia"),
    });
  });
});

describe("consultar_guia and resumo_operacional", () => {
  beforeEach(async () => {
    services = createTestServices();
    await seed();
  });

  it("reads back the stored decision with its evidence", async () => {
    const tool = consultarGuiaTool(services);
    const result = await tool.handler({ id_guia: "G-2608-0069" });

    expect(result).toMatchObject({ encontrada: true, status: "REVIEW_REQUIRED" });
    expect(result.findings[0]?.evidence).toContain("drenagem linfática");
  });

  it("reports a guide that does not exist", async () => {
    const tool = consultarGuiaTool(services);

    await expect(tool.handler({ id_guia: "G-NOPE" })).resolves.toMatchObject({
      encontrada: false,
      status: null,
    });
  });

  it("summarizes the portfolio with money and a work queue", async () => {
    const tool = resumoOperacionalTool(services);
    const result = await tool.handler({});

    expect(result.verificadas).toBe(80);
    expect(
      result.prontasParaEnvio + result.precisamCorrecao + result.precisamRevisao,
    ).toBe(80);
    expect(result.valorEmRisco).toBeGreaterThan(0);
    expect(result.porUnidade.map((unit) => unit.unidade).toSorted()).toEqual([
      "Centro",
      "Norte",
      "Sul",
    ]);
    expect(result.filaDeTrabalho.length).toBeGreaterThan(0);
  });

  it("applies filters", async () => {
    const tool = resumoOperacionalTool(services);
    const result = await tool.handler({ unidade: "Norte" });

    expect(result.verificadas).toBeLessThan(80);
    expect(result.porUnidade).toHaveLength(1);
  });
});

describe("POST /mcp", () => {
  beforeEach(() => {
    services = createTestServices();
  });

  function call(body: unknown): Promise<Response> {
    return mcpEndpoint(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          ...bearer(TEST_MCP_KEY),
        },
        body: JSON.stringify(body),
      }),
    );
  }

  it("completes an initialize handshake without creating a session", async () => {
    const response = await call({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("mcp-session-id")).toBeNull();

    const body = await response.json();
    expect(body.result.serverInfo.name).toBe("vitalis-preflight");
  });

  it("lists the four read-only tools with descriptions and schemas", async () => {
    await call({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
      },
    });

    const response = await call({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const body = await response.json();

    const names = body.result.tools.map((tool: { name: string }) => tool.name);
    expect(names.toSorted()).toEqual([
      "consultar_guia",
      "consultar_regra_convenio",
      "resumo_operacional",
      "verificar_guia",
    ]);

    for (const tool of body.result.tools) {
      expect(tool.description.length).toBeGreaterThan(80);
      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toBeDefined();
      expect(tool.annotations.readOnlyHint).toBe(true);
    }
  });

  it("returns structured content when a tool is called over the protocol", async () => {
    await call({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
      },
    });

    const response = await call({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "consultar_regra_convenio",
        arguments: { convenio: "Saúde Interior", procedimento_codigo: "40201015" },
      },
    });

    const body = await response.json();
    expect(body.result.structuredContent).toMatchObject({
      convenio: "Saúde Interior",
      coberto: true,
      limiteSessoesPorAutorizacao: 20,
    });
  });
});
