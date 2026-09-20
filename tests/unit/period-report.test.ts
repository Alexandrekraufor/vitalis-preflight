import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { importGuides } from "@/application/imports/import-guides.use-case";
import type { GuideRepository } from "@/application/ports/guide-repository.port";
import { getPeriodReport } from "@/application/reports/get-period-report.use-case";
import { parseGuideCsv } from "@/infrastructure/csv/guide-csv.parser";
import { toIsoDate, type IsoDate } from "@/lib/dates";
import { createTestServices } from "@tests/fixtures/test-services";

function isoDate(value: string): IsoDate {
  const parsed = toIsoDate(value);
  if (parsed === null) throw new Error(`Data de teste inválida: ${value}`);
  return parsed;
}

describe("getPeriodReport", () => {
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

  it("counts the same guides the list returns for that window", async () => {
    // The report links to the guides list carrying its own week. If the two
    // cuts ever disagree, the owner clicks a number and lands on a different
    // set - which is exactly what reads as inconsistent data.
    const report = await getPeriodReport(guides, { through: isoDate("2026-08-28") });
    if (report === null) throw new Error("relatório sem dados");

    const listed = await guides.list({
      from: report.period.from,
      through: report.period.through,
    });

    expect(listed).toHaveLength(report.summary.total);
    expect(report.portfolioGuides).toBeGreaterThan(report.summary.total);

    const blocked = await guides.list({
      status: "NEEDS_CORRECTION",
      from: report.period.from,
      through: report.period.through,
    });

    expect(blocked).toHaveLength(report.summary.needsCorrection);
  });

  it("covers a seven-day window ending on the requested day", async () => {
    const report = await getPeriodReport(guides, { through: isoDate("2026-08-28") });

    expect(report?.period).toEqual({ from: "2026-08-22", through: "2026-08-28" });
  });

  it("counts only guides whose appointment falls inside the period", async () => {
    const report = await getPeriodReport(guides, { through: isoDate("2026-08-28") });
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
    const report = await getPeriodReport(guides, { through: isoDate("2026-08-28") });

    expect(report?.previous).toMatchObject({
      guidesChecked: expect.any(Number),
      problemShare: expect.any(Number),
    });
    expect(report?.problemShare).toBeGreaterThanOrEqual(0);
    expect(report?.problemShare).toBeLessThanOrEqual(1);
  });

  it("omits the comparison when the preceding period has no data", async () => {
    const report = await getPeriodReport(guides, { through: isoDate("2026-08-07") });

    expect(report?.previous).toBeNull();
  });

  it("defaults to the week of the most recent appointment", async () => {
    const report = await getPeriodReport(guides);

    expect(report?.period.through).toBe("2026-08-28");
  });

  it("returns null when nothing has been validated yet", async () => {
    const empty = createTestServices();

    await expect(getPeriodReport(empty.guides)).resolves.toBeNull();
  });
});

describe("getPeriodReport under filters", () => {
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

  it("opens the window to the number of days asked for", async () => {
    const report = await getPeriodReport(guides, {
      days: 30,
      through: isoDate("2026-08-28"),
    });

    expect(report?.days).toBe(30);
    expect(report?.period).toEqual({ from: "2026-07-30", through: "2026-08-28" });
  });

  it("compares a thirty-day window with the thirty days before it, not with a week", async () => {
    const report = await getPeriodReport(guides, {
      days: 30,
      through: isoDate("2026-08-28"),
    });
    if (report === null) throw new Error("relatório sem dados");

    const before = await guides.list({
      from: isoDate("2026-06-30"),
      through: isoDate("2026-07-29"),
    });

    expect(report.previous?.guidesChecked ?? 0).toBe(before.length);
  });

  it("derives the window length from an explicit range", async () => {
    const report = await getPeriodReport(guides, {
      from: isoDate("2026-08-01"),
      through: isoDate("2026-08-15"),
    });

    expect(report?.days).toBe(15);
    expect(report?.period).toEqual({ from: "2026-08-01", through: "2026-08-15" });
  });

  it("reports one unit without letting the others into any number", async () => {
    const whole = await getPeriodReport(guides, { days: 90, through: isoDate("2026-08-31") });
    const norte = await getPeriodReport(guides, {
      days: 90,
      through: isoDate("2026-08-31"),
      unit: "Norte",
    });
    if (whole === null || norte === null) throw new Error("relatório sem dados");

    expect(norte.scope.unit).toBe("Norte");
    expect(norte.summary.total).toBeLessThan(whole.summary.total);
    expect(norte.summary.byUnit.map((unit) => unit.unit)).toEqual(["Norte"]);
    expect(norte.summary.byConvention.every((entry) => entry.total > 0)).toBe(true);
    // The cross-reference has to narrow with the filter, otherwise the footnote
    // would compare one unit against the whole clinic.
    expect(norte.portfolioGuides).toBeLessThan(whole.portfolioGuides);
  });

  it("reports one convention the same way", async () => {
    const report = await getPeriodReport(guides, {
      days: 90,
      through: isoDate("2026-08-31"),
      convention: "Vitalcard",
    });
    if (report === null) throw new Error("relatório sem dados");

    expect(report.scope.convention).toBe("Vitalcard");
    expect(report.summary.byConvention.map((entry) => entry.convention)).toEqual(["Vitalcard"]);
  });

  it("refuses to invert a hand-edited window", async () => {
    const report = await getPeriodReport(guides, {
      from: isoDate("2026-08-28"),
      through: isoDate("2026-08-01"),
    });

    // Nothing is thrown and nothing is inverted: the window collapses onto the
    // day the reader asked to end on.
    expect(report?.period.from).toBe("2026-08-01");
    expect(report?.period.through).toBe("2026-08-01");
  });
});
