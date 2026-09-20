import { describe, expect, it } from "vitest";

import { findAttentionPoint } from "@/application/reports/attention-point";
import { summarizePortfolio } from "@/application/reports/portfolio-summary";
import type { GuideListItem } from "@/application/ports/guide-repository.port";
import type { GuideStatus } from "@/domain/guides/guide-status";
import type { ClinicUnit } from "@/domain/guides/guide.types";
import { toIsoDate } from "@/lib/dates";
import { fromCents } from "@/lib/money";

function item(
  id: string,
  unit: ClinicUnit,
  status: GuideStatus,
  code?: string,
): GuideListItem {
  const appointmentDate = toIsoDate("2026-08-20");
  if (appointmentDate === null) throw new Error("data inválida");

  return {
    idGuia: id,
    unit,
    conventionName: "Vitalcard",
    patient: "P-1",
    procedureCode: "50000470",
    procedureDescription: null,
    appointmentDate,
    amount: fromCents(6200),
    status,
    amountAtRisk: fromCents(status === "READY_TO_SUBMIT" ? 0 : 6200),
    primaryFindingCode: code ?? null,
    primaryFindingMessage: code === undefined ? null : "…",
    validatedAt: new Date("2026-08-21T10:00:00Z"),
  };
}

describe("findAttentionPoint", () => {
  it("says nothing when there are too few problems to generalize from", () => {
    const summary = summarizePortfolio([
      item("G-1", "Norte", "NEEDS_CORRECTION", "CID_MISSING"),
      item("G-2", "Centro", "READY_TO_SUBMIT"),
    ]);

    // Two guides, one problem: "Norte concentra 100%" would be arithmetic, not
    // a finding.
    expect(findAttentionPoint(summary)).toBeNull();
  });

  it("names a unit that genuinely concentrates the problems", () => {
    const summary = summarizePortfolio([
      item("G-1", "Norte", "NEEDS_CORRECTION", "CID_MISSING"),
      item("G-2", "Norte", "NEEDS_CORRECTION", "AUTHORIZATION_EXPIRED"),
      item("G-3", "Norte", "REVIEW_REQUIRED", "UNKNOWN_PROCEDURE"),
      item("G-4", "Centro", "NEEDS_CORRECTION", "AUTHORIZATION_EXPIRED"),
      item("G-5", "Sul", "READY_TO_SUBMIT"),
    ]);

    const attention = findAttentionPoint(summary);

    expect(attention?.headline).toContain("Norte");
    expect(attention?.headline).toContain("75%");
    expect(attention?.detail).toContain("3 das 4");
  });

  it("falls back to the dominant cause when no unit stands out", () => {
    const summary = summarizePortfolio([
      item("G-1", "Norte", "NEEDS_CORRECTION", "AUTHORIZATION_EXPIRED"),
      item("G-2", "Centro", "NEEDS_CORRECTION", "AUTHORIZATION_EXPIRED"),
      item("G-3", "Sul", "NEEDS_CORRECTION", "AUTHORIZATION_EXPIRED"),
      item("G-4", "Norte", "READY_TO_SUBMIT"),
      item("G-5", "Centro", "READY_TO_SUBMIT"),
      item("G-6", "Sul", "READY_TO_SUBMIT"),
    ]);

    const attention = findAttentionPoint(summary);

    expect(attention?.headline).toContain("autorização vencida");
    expect(attention?.headline).toContain("100%");
  });

  it("says nothing when problems are spread evenly across units and causes", () => {
    const summary = summarizePortfolio([
      item("G-1", "Norte", "NEEDS_CORRECTION", "CID_MISSING"),
      item("G-2", "Centro", "NEEDS_CORRECTION", "AUTHORIZATION_EXPIRED"),
      item("G-3", "Sul", "NEEDS_CORRECTION", "PROCEDURE_NOT_COVERED"),
      item("G-4", "Norte", "READY_TO_SUBMIT"),
      item("G-5", "Centro", "READY_TO_SUBMIT"),
      item("G-6", "Sul", "READY_TO_SUBMIT"),
    ]);

    expect(findAttentionPoint(summary)).toBeNull();
  });

  it("says nothing about a single unit when that is all there is", () => {
    const summary = summarizePortfolio([
      item("G-1", "Norte", "NEEDS_CORRECTION", "CID_MISSING"),
      item("G-2", "Norte", "NEEDS_CORRECTION", "AUTHORIZATION_EXPIRED"),
      item("G-3", "Norte", "REVIEW_REQUIRED", "UNKNOWN_PROCEDURE"),
    ]);

    const attention = findAttentionPoint(summary);

    // One unit cannot "concentrate" anything; the answer, if any, must be a cause.
    expect(attention?.headline ?? "").not.toContain("unidade Norte");
  });
});
