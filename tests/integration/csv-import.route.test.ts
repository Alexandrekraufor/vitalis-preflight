import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppServices } from "@/infrastructure/composition-root";
import { signIn, type SignedInUser } from "@tests/fixtures/sessions";
import { bearer, createTestServices, TEST_API_KEY } from "@tests/fixtures/test-services";

let services: AppServices;
let operator: SignedInUser;

vi.mock("@/infrastructure/composition-root", () => ({
  appServices: () => Promise.resolve(services),
}));

const { POST: importCsv } = await import("@/app/api/internal/imports/csv/route");
const { GET: exportCsv } = await import("@/app/api/internal/guides/export/route");
const { GET: listGuides } = await import("@/app/api/v1/guides/route");

const DATASET = readFileSync(
  path.join(process.cwd(), "data", "source", "guias.csv"),
  "utf8",
);

function upload(contents: string, fileName = "guias.csv"): Promise<Response> {
  const form = new FormData();
  form.set("file", new File([contents], fileName, { type: "text/csv" }));
  return importCsv(
    new Request("http://localhost/api/internal/imports/csv", {
      method: "POST",
      body: form,
      headers: operator.cookie,
    }),
  );
}

function exportRequest(kind: string): Request {
  return new Request(`http://localhost/api/internal/guides/export?kind=${kind}`, {
    headers: operator.cookie,
  });
}

describe("POST /api/internal/imports/csv", () => {
  beforeEach(async () => {
    services = createTestServices();
    operator = await signIn(services.access, "MEMBER");
  });

  it("imports the shipped dataset and summarizes the outcome", async () => {
    const response = await upload(DATASET);

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.imported).toBe(80);
    expect(body.rejected).toEqual([]);
    expect(body.newVersions).toBe(80);
    expect(body.automaticNormalizations).toBe(3);
    expect(
      body.readyToSubmit + body.needsCorrection + body.reviewRequired,
    ).toBe(80);
  });

  it("does not create a second version when the same file is imported again", async () => {
    await upload(DATASET);
    const response = await upload(DATASET);

    const body = await response.json();
    expect(body.imported).toBe(80);
    expect(body.newVersions).toBe(0);
  });

  it("creates a new version when a guide actually changed", async () => {
    await upload(DATASET);
    const edited = DATASET.replace("G-2608-0001,Sul", "G-2608-0001,Norte");

    const body = await (await upload(edited)).json();
    expect(body.newVersions).toBe(1);
  });

  it("rejects a file whose header is missing columns", async () => {
    const response = await upload("id_guia,unidade\nG-1,Centro\n");

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_FILE" },
    });
  });

  it("reports unparseable rows without losing the rest of the batch", async () => {
    const broken = DATASET.replace("G-2608-0002,Sul,2026-08-06", "G-2608-0002,Leste,2026-08-06");
    const body = await (await upload(broken)).json();

    expect(body.imported).toBe(79);
    expect(body.rejected).toEqual([
      expect.objectContaining({
        idGuia: "G-2608-0002",
        issues: expect.arrayContaining([expect.objectContaining({ field: "unidade" })]),
      }),
    ]);
  });

  it("keeps quoted reception notes intact through the round trip", async () => {
    await upload(DATASET);

    const response = await listGuides(
      new Request("http://localhost/api/v1/guides?search=G-2608-0030", {
        headers: bearer(TEST_API_KEY),
      }),
    );
    const body = await response.json();

    expect(body.guides[0]).toMatchObject({
      idGuia: "G-2608-0030",
      status: "NEEDS_CORRECTION",
    });
  });
});

describe("GET /api/internal/guides/export", () => {
  beforeEach(async () => {
    services = createTestServices();
    operator = await signIn(services.access, "MEMBER");
    await upload(DATASET);
  });

  it("exports the submittable guides in the original 18 columns", async () => {
    const response = await exportCsv(exportRequest("ready"));

    expect(response.headers.get("content-type")).toContain("text/csv");

    const lines = (await response.text()).trim().split("\r\n");
    expect(lines[0]?.split(",")).toHaveLength(18);
    expect(lines.length).toBeGreaterThan(1);
  });

  it("exports one line per problem in the pending file", async () => {
    const response = await exportCsv(exportRequest("pending"));

    const lines = (await response.text()).trim().split("\r\n");
    expect(lines[0]).toContain("acao_recomendada");
    expect(lines.length).toBeGreaterThan(1);
  });

  it("rejects an unknown export kind", async () => {
    const response = await exportCsv(exportRequest("everything"));

    expect(response.status).toBe(400);
  });
});
