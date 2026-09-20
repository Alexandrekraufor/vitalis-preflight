import { beforeEach, describe, expect, it, vi } from "vitest";

import { validationReportSchema } from "@/application/guides/validation-report";
import type { AppServices } from "@/infrastructure/composition-root";
import { aGuideRecord } from "@tests/fixtures/guide-record";
import { bearer, createTestServices, TEST_API_KEY } from "@tests/fixtures/test-services";

let services: AppServices;

vi.mock("@/infrastructure/composition-root", () => ({
  appServices: () => Promise.resolve(services),
}));

const { POST } = await import("@/app/api/v1/guides/validate/route");
const { GET: getGuide } = await import("@/app/api/v1/guides/[id]/route");

function post(body: unknown, contentType = "application/json"): Promise<Response> {
  return POST(
    new Request("http://localhost/api/v1/guides/validate", {
      method: "POST",
      headers: { "content-type": contentType, ...bearer(TEST_API_KEY) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

function getGuideRequest(): Request {
  return new Request("http://localhost/api/v1/guides/x", { headers: bearer(TEST_API_KEY) });
}

describe("POST /api/v1/guides/validate", () => {
  beforeEach(() => {
    services = createTestServices();
  });

  it("returns 200 and a clean decision for a valid guide", async () => {
    const response = await post(aGuideRecord({ id_guia: "G-API-0001" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      idGuia: "G-API-0001",
      status: "READY_TO_SUBMIT",
      canSubmit: true,
      amountAtRisk: 0,
      findings: [],
      rules: { version: "agosto/2026" },
    });
  });

  it("answers exactly the contract it publishes", async () => {
    const response = await post(
      aGuideRecord({ id_guia: "G-API-0100", valor: "62,00", cid: "" }),
    );

    // The same schema the MCP tools publish as their output schema: if the
    // response ever drifts from the documented contract, this fails.
    const parsed = validationReportSchema.safeParse(await response.json());

    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
  });

  it("returns 200 with findings when the preflight ran and found problems", async () => {
    const response = await post(
      aGuideRecord({ id_guia: "G-API-0002", numero_autorizacao: "" }),
    );

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      status: "NEEDS_CORRECTION",
      canSubmit: false,
      amountAtRisk: 62,
    });
    expect(body.findings[0]).toMatchObject({
      code: "AUTHORIZATION_NUMBER_MISSING",
      field: "numero_autorizacao",
    });
    expect(body.recommendedActions.length).toBeGreaterThan(0);
  });

  it("reports the normalizations it applied", async () => {
    const response = await post(
      aGuideRecord({ id_guia: "G-API-0003", valor: "62,00", data_atendimento: "20/08/2026" }),
    );

    const body = await response.json();
    expect(body.normalizations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "valor", kind: "DECIMAL_SEPARATOR" }),
        expect.objectContaining({ field: "data_atendimento", kind: "DATE_REFORMATTED" }),
      ]),
    );
  });

  it("accepts a guide whose numeric fields arrive as JSON numbers", async () => {
    const response = await post({
      ...aGuideRecord({ id_guia: "G-API-0004" }),
      valor: 62,
      sessao_numero_na_autorizacao: 3,
      autorizacao_sessoes_limite: 10,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "READY_TO_SUBMIT" });
  });

  it("returns 400 for a body that is not JSON", async () => {
    const response = await post("not json at all");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_JSON" },
    });
  });

  it("returns 400 when the body is not an object", async () => {
    const response = await post(["G-API-0005"]);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_PAYLOAD" },
    });
  });

  it("returns 422 with field-level detail when the guide cannot be parsed", async () => {
    const response = await post(
      aGuideRecord({ id_guia: "G-API-0006", data_atendimento: "31/02/2026", unidade: "Leste" }),
    );

    expect(response.status).toBe(422);

    const body = await response.json();
    expect(body.error.code).toBe("UNPROCESSABLE_GUIDE");
    expect(body.error.details.map((detail: { field: string }) => detail.field)).toEqual(
      expect.arrayContaining(["data_atendimento", "unidade"]),
    );
  });

  it("never leaks internals when the application fails", async () => {
    const base = createTestServices();
    services = {
      ...base,
      access: {
        ...base.access,
        recordAuditEvent: () =>
          Promise.reject(new Error("connection refused at 10.0.0.7:5432")),
      },
    };

    const response = await post(aGuideRecord({ id_guia: "G-API-0007" }));
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).not.toContain("10.0.0.7");
    expect(body).not.toContain("5432");
    expect(JSON.parse(body)).toMatchObject({ error: { code: "INTERNAL_ERROR" } });
  });

  it("does not ingest the guide it was asked to validate", async () => {
    await post(aGuideRecord({ id_guia: "G-API-0008", cid: "" }));

    // Validation is a computation, not an ingestion: nothing about the clinic's
    // operational data may change because an integrator asked a question.
    await expect(services.guides.list({})).resolves.toEqual([]);

    const response = await getGuide(getGuideRequest(), {
      params: Promise.resolve({ id: "G-API-0008" }),
    });

    expect(response.status).toBe(404);
  });

  it("records one audit line per validation, without the payload", async () => {
    await post(aGuideRecord({ id_guia: "G-API-0009", cid: "" }));

    const events = await services.access.listAuditEvents(10);

    expect(events).toEqual([
      expect.objectContaining({
        action: "GUIDE_VALIDATION_REQUESTED",
        actorKind: "API_KEY",
        subject: "G-API-0009",
        metadata: { decision: "NEEDS_CORRECTION", mode: "CREDENTIAL" },
      }),
    ]);
  });

  it("returns 404 for a guide that was never ingested", async () => {
    const response = await getGuide(getGuideRequest(), {
      params: Promise.resolve({ id: "G-DOES-NOT-EXIST" }),
    });

    expect(response.status).toBe(404);
  });
});
