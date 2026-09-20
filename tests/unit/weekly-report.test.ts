import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { importGuides } from "@/application/imports/import-guides.use-case";
import type { GuideRepository } from "@/application/ports/guide-repository.port";
import { getWeeklyReport } from "@/application/reports/get-weekly-report.use-case";
import { parseGuideCsv } from "@/infrastructure/csv/guide-csv.parser";
import { toIsoDate, type IsoDate } from "@/lib/dates";
import { createTestServices } from "@tests/fixtures/test-services";

function isoDate(value: string): IsoDate {
  const parsed = toIsoDate(value);
  if (parsed === null) throw new Error(`Data de teste inválida: ${value}`);
  return parsed;
}

describe("getWeeklyReport", () => {
  let guides: GuideRepository;

  beforeAll(async () => {
    const services = createTestServices();
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

    guides = services.guides;
  });

  it("covers a seven-day window ending on the requested day", async () => {
    const report = await getWeeklyReport(guides, { through: isoDate("2026-08-28") });

    expect(report?.period).toEqual({ from: "2026-08-22", through: "2026-08-28" });
  });

  it("counts only guides whose appointment falls inside the period", async () => {
    const report = await getWeeklyReport(guides, { through: isoDate("2026-08-28") });
    expect(report).not.toBeNull();
    if (report === null) return;

    const { summary } = report;
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.total).toBeLessThan(80);
    expect(summary.readyToSubmit + summary.needsCorrection + summary.reviewRequired).toBe(
      summary.total,
    );
  });

  it("compares against the preceding seven days", async () => {
    const report = await getWeeklyReport(guides, { through: isoDate("2026-08-28") });

    expect(report?.previous).toMatchObject({
      guidesChecked: expect.any(Number),
      problemShare: expect.any(Number),
    });
    expect(report?.problemShare).toBeGreaterThanOrEqual(0);
    expect(report?.problemShare).toBeLessThanOrEqual(1);
  });

  it("omits the comparison when the preceding period has no data", async () => {
    const report = await getWeeklyReport(guides, { through: isoDate("2026-08-07") });

    expect(report?.previous).toBeNull();
  });

  it("defaults to the week of the most recent appointment", async () => {
    const report = await getWeeklyReport(guides);

    expect(report?.period.through).toBe("2026-08-28");
  });

  it("returns null when nothing has been validated yet", async () => {
    const empty = createTestServices();

    await expect(getWeeklyReport(empty.guides)).resolves.toBeNull();
  });
});
