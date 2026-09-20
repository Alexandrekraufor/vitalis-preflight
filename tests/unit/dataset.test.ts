import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import type { ValidationResult } from "@/domain/guides/validation-result";
import type { RawGuideRecord } from "@/domain/normalization/normalization.types";
import { parseGuideCsv } from "@/infrastructure/csv/guide-csv.parser";
import { validateRecord } from "@tests/fixtures/validate";

const CSV_PATH = path.join(process.cwd(), "data", "source", "guias.csv");

/**
 * The shipped dataset is part of the contract of this exercise: these tests pin
 * the decisions the reviewers will read on screen to the rules in the rule file.
 */
describe("shipped dataset", () => {
  let records: readonly RawGuideRecord[];
  const results = new Map<string, ValidationResult>();

  beforeAll(async () => {
    const parsed = parseGuideCsv(readFileSync(CSV_PATH, "utf8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    records = parsed.value;

    for (const record of records) {
      const result = await validateRecord(record);
      results.set(result.guide.idGuia, result);
    }
  });

  function resultOf(idGuia: string): ValidationResult {
    const result = results.get(idGuia);
    if (result === undefined) throw new Error(`Guia ${idGuia} não encontrada no dataset.`);
    return result;
  }

  function codesOf(idGuia: string): readonly string[] {
    return resultOf(idGuia).findings.map((finding) => finding.code);
  }

  it("parses all 80 guides with the 18 expected columns", () => {
    expect(records).toHaveLength(80);
  });

  it("assigns every guide one of the three decisions", () => {
    for (const result of results.values()) {
      expect(["READY_TO_SUBMIT", "NEEDS_CORRECTION", "REVIEW_REQUIRED"]).toContain(
        result.decision.status,
      );
    }
  });

  it("normalizes the two DD/MM/YYYY dates in the file", async () => {
    expect(resultOf("G-2608-0016").guide.appointmentDate).toBe("2026-08-03");
    expect(resultOf("G-2608-0027").guide.appointmentDate).toBe("2026-08-26");
  });

  it("G-2608-0030: expired authorization plus a new one that was never keyed in", () => {
    const result = resultOf("G-2608-0030");

    expect(codesOf("G-2608-0030")).toEqual(
      expect.arrayContaining(["AUTHORIZATION_EXPIRED", "NEW_AUTHORIZATION_NOT_REGISTERED"]),
    );
    expect(result.decision.status).toBe("NEEDS_CORRECTION");
    expect(result.decision.canSubmit).toBe(false);
  });

  it("G-2608-0039: private billing requested, so a human decides", () => {
    const result = resultOf("G-2608-0039");

    expect(codesOf("G-2608-0039")).toEqual(["PRIVATE_BILLING_REQUESTED"]);
    expect(result.decision.status).toBe("REVIEW_REQUIRED");
  });

  it("G-2608-0041: verbal authorization still needs its number before submission", () => {
    const result = resultOf("G-2608-0041");

    expect(codesOf("G-2608-0041")).toEqual([
      "AUTHORIZATION_NUMBER_MISSING",
      "VERBAL_AUTHORIZATION_PENDING_NUMBER",
    ]);
    expect(result.decision.status).toBe("NEEDS_CORRECTION");
  });

  it("G-2608-0069: the note contradicts the procedure and no code is invented", () => {
    const result = resultOf("G-2608-0069");

    expect(codesOf("G-2608-0069")).toEqual(["PROCEDURE_CONTRADICTED_BY_NOTE"]);
    expect(result.decision.status).toBe("REVIEW_REQUIRED");
    expect(result.findings[0]?.evidence).toContain("drenagem linfática");
  });

  it("G-2608-0016: a rescheduled session is not turned into an error", () => {
    const result = resultOf("G-2608-0016");

    expect(result.decision.status).toBe("READY_TO_SUBMIT");
  });

  it("every finding carries an action or is purely informational", () => {
    for (const result of results.values()) {
      for (const finding of result.findings) {
        if (finding.severity === "INFO") continue;
        expect(finding.recommendedAction).not.toBeNull();
      }
    }
  });

  it("every note-derived finding quotes the note it came from", () => {
    for (const result of results.values()) {
      for (const finding of result.findings) {
        if (finding.source !== "RECEPTION_NOTE") continue;
        expect(finding.evidence).toBeTruthy();
        expect(result.guide.receptionNote).toContain(finding.evidence?.slice(0, 20) ?? "");
      }
    }
  });

  it("only puts money at risk for guides that cannot be submitted", () => {
    for (const result of results.values()) {
      if (result.decision.canSubmit) {
        expect(result.decision.amountAtRisk).toBe(0);
      } else {
        expect(result.decision.amountAtRisk).toBeGreaterThan(0);
      }
    }
  });
});
