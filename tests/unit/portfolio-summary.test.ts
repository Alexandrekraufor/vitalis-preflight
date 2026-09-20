import { describe, expect, it } from "vitest";

import type { GuideListItem } from "@/application/ports/guide-repository.port";
import {
  statusShare,
  summarizePortfolio,
} from "@/application/reports/portfolio-summary";
import type { GuideStatus } from "@/domain/guides/guide-status";
import type { ClinicUnit } from "@/domain/guides/guide.types";
import { fromCents } from "@/lib/money";
import { toIsoDate } from "@/lib/dates";

interface ItemOverrides {
  readonly status: GuideStatus;
  readonly unit: ClinicUnit;
  readonly amountCents: number;
  readonly primaryFindingCode?: string;
  readonly convention?: string;
}

function anItem(id: string, overrides: ItemOverrides): GuideListItem {
  const appointmentDate = toIsoDate("2026-08-20");
  if (appointmentDate === null) throw new Error("data de teste inválida");

  const atRisk = overrides.status === "READY_TO_SUBMIT" ? 0 : overrides.amountCents;

  return {
    idGuia: id,
    unit: overrides.unit,
    conventionName: overrides.convention ?? "Vitalcard",
    patient: "P-1",
    procedureCode: "50000470",
    procedureDescription: null,
    appointmentDate,
    amount: fromCents(overrides.amountCents),
    status: overrides.status,
    amountAtRisk: fromCents(atRisk),
    primaryFindingCode: overrides.primaryFindingCode ?? null,
    primaryFindingMessage: overrides.primaryFindingCode === undefined ? null : "…",
    validatedAt: new Date("2026-08-21T10:00:00Z"),
  };
}

const PORTFOLIO: readonly GuideListItem[] = [
  anItem("G-1", { status: "READY_TO_SUBMIT", unit: "Centro", amountCents: 6200 }),
  anItem("G-2", {
    status: "READY_TO_SUBMIT",
    unit: "Norte",
    amountCents: 7000,
    convention: "Plano Bem",
  }),
  anItem("G-3", {
    status: "NEEDS_CORRECTION",
    unit: "Centro",
    amountCents: 6200,
    primaryFindingCode: "CID_MISSING",
  }),
  anItem("G-4", {
    status: "NEEDS_CORRECTION",
    unit: "Sul",
    amountCents: 9000,
    primaryFindingCode: "CID_MISSING",
  }),
  anItem("G-5", {
    status: "REVIEW_REQUIRED",
    unit: "Sul",
    amountCents: 14000,
    primaryFindingCode: "PROCEDURE_CONTRADICTED_BY_NOTE",
    convention: "Plano Bem",
  }),
];

describe("summarizePortfolio", () => {
  it("counts each decision", () => {
    expect(summarizePortfolio(PORTFOLIO)).toMatchObject({
      total: 5,
      readyToSubmit: 2,
      needsCorrection: 2,
      reviewRequired: 1,
    });
  });

  it("separates money at risk from money protected, and totals the period", () => {
    const summary = summarizePortfolio(PORTFOLIO);

    expect(summary.amountAtRisk).toBe(6200 + 9000 + 14000);
    expect(summary.amountProtected).toBe(6200 + 7000);
    expect(summary.amountBilled).toBe(6200 + 7000 + 6200 + 9000 + 14000);
  });

  it("ranks conventions by volume, with what each one bills and risks", () => {
    const summary = summarizePortfolio(PORTFOLIO);

    expect(summary.byConvention).toEqual([
      {
        convention: "Vitalcard",
        total: 3,
        readyToSubmit: 1,
        needsCorrection: 2,
        reviewRequired: 0,
        amountAtRisk: 6200 + 9000,
        amountBilled: 6200 + 6200 + 9000,
      },
      {
        convention: "Plano Bem",
        total: 2,
        readyToSubmit: 1,
        needsCorrection: 0,
        reviewRequired: 1,
        amountAtRisk: 14000,
        amountBilled: 7000 + 14000,
      },
    ]);
  });

  it("names the convention that dominates each unit", () => {
    const byUnit = summarizePortfolio(PORTFOLIO).byUnit;

    expect(byUnit.map((unit) => [unit.unit, unit.topConvention?.convention])).toEqual([
      ["Centro", "Vitalcard"],
      ["Norte", "Plano Bem"],
      ["Sul", "Plano Bem"],
    ]);
    // Sul has one guide from each: the tie breaks alphabetically, and the
    // share says plainly that this is half the unit, not a landslide.
    expect(byUnit.at(2)?.topConvention).toEqual({
      convention: "Plano Bem",
      guides: 1,
      share: 0.5,
    });
  });

  it("ranks problems by how many guides they block, with a readable label", () => {
    const summary = summarizePortfolio(PORTFOLIO);

    expect(summary.topProblems).toEqual([
      { code: "CID_MISSING", label: "CID ausente", guides: 2, amountAtRisk: 15200 },
      {
        code: "PROCEDURE_CONTRADICTED_BY_NOTE",
        label: "Observação contradiz o procedimento",
        guides: 1,
        amountAtRisk: 14000,
      },
    ]);
  });

  it("breaks the portfolio down by unit", () => {
    const summary = summarizePortfolio(PORTFOLIO);

    expect(summary.byUnit).toEqual([
      expect.objectContaining({ unit: "Centro", total: 2, readyToSubmit: 1, amountAtRisk: 6200 }),
      expect.objectContaining({ unit: "Norte", total: 1, readyToSubmit: 1, amountAtRisk: 0 }),
      expect.objectContaining({ unit: "Sul", total: 2, readyToSubmit: 0, amountAtRisk: 23000 }),
    ]);
  });

  it("falls back to the raw code when a stored finding code is unknown to this build", () => {
    const legacy = [
      anItem("G-9", {
        status: "NEEDS_CORRECTION",
        unit: "Centro",
        amountCents: 6200,
        primaryFindingCode: "CODE_FROM_AN_OLDER_RELEASE",
      }),
    ];

    expect(summarizePortfolio(legacy).topProblems[0]).toMatchObject({
      code: "CODE_FROM_AN_OLDER_RELEASE",
      label: "CODE_FROM_AN_OLDER_RELEASE",
    });
  });

  it("handles an empty portfolio without dividing by zero", () => {
    const summary = summarizePortfolio([]);

    expect(summary).toMatchObject({ total: 0, amountAtRisk: 0, amountProtected: 0 });
    expect(summary.byUnit).toEqual([]);
    expect(statusShare(summary)).toBe(0);
  });

  it("reports the share of guides with a problem", () => {
    expect(statusShare(summarizePortfolio(PORTFOLIO))).toBeCloseTo(0.6);
  });
});
