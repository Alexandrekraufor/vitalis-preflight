import { describe, expect, it } from "vitest";

import { normalizeGuideRecord } from "@/domain/normalization/normalize-guide";
import { parseGuide } from "@/domain/guides/guide";
import { aGuideRecord } from "@tests/fixtures/guide-record";

describe("normalizeGuideRecord", () => {
  it("keeps an already well-formed ISO date untouched", () => {
    const { record, changes } = normalizeGuideRecord({ data_atendimento: "2026-08-03" });

    expect(record.data_atendimento).toBe("2026-08-03");
    expect(changes).toHaveLength(0);
  });

  it("rewrites DD/MM/YYYY to ISO and records the change", () => {
    const { record, changes } = normalizeGuideRecord({ data_atendimento: "03/08/2026" });

    expect(record.data_atendimento).toBe("2026-08-03");
    expect(changes).toEqual([
      expect.objectContaining({
        field: "data_atendimento",
        kind: "DATE_REFORMATTED",
        from: "03/08/2026",
        to: "2026-08-03",
      }),
    ]);
  });

  it("leaves an impossible DD/MM/YYYY date alone so parsing can reject it", () => {
    const { record, changes } = normalizeGuideRecord({ data_atendimento: "31/02/2026" });

    expect(record.data_atendimento).toBe("31/02/2026");
    expect(changes).toHaveLength(0);
  });

  it("accepts a decimal amount written with a dot without changing it", () => {
    const { record, changes } = normalizeGuideRecord({ valor: "62.00" });

    expect(record.valor).toBe("62.00");
    expect(changes).toHaveLength(0);
  });

  it("converts a comma decimal amount and records the change", () => {
    const { record, changes } = normalizeGuideRecord({ valor: "62,00" });

    expect(record.valor).toBe("62.00");
    expect(changes).toEqual([
      expect.objectContaining({ field: "valor", kind: "DECIMAL_SEPARATOR" }),
    ]);
  });

  it("collapses excess whitespace", () => {
    const { record, changes } = normalizeGuideRecord({ paciente: "  P-1044   " });

    expect(record.paciente).toBe("P-1044");
    expect(changes).toEqual([
      expect.objectContaining({ field: "paciente", kind: "TRIMMED_WHITESPACE" }),
    ]);
  });

  it("treats blank strings as absent values", () => {
    const { record } = normalizeGuideRecord({ cid: "   " });

    expect(record.cid).toBeNull();
  });

  it("never rewrites clinical or contractual content", () => {
    const { record, changes } = normalizeGuideRecord({
      cid: "m79.7",
      procedimento_codigo: "5000047O",
      numero_autorizacao: "aut 123",
    });

    expect(record.cid).toBe("m79.7");
    expect(record.procedimento_codigo).toBe("5000047O");
    expect(record.numero_autorizacao).toBe("aut 123");
    expect(changes).toHaveLength(0);
  });
});

describe("parseGuide", () => {
  it("parses a normalized record into a typed guide", () => {
    const parsed = parseGuide(aGuideRecord({ valor: "62,00", data_atendimento: "03/08/2026" }));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.value.guide.amount).toBe(6200);
    expect(parsed.value.guide.appointmentDate).toBe("2026-08-03");
    expect(parsed.value.normalizations).toHaveLength(2);
  });

  it("reports structural issues instead of throwing", () => {
    const parsed = parseGuide(aGuideRecord({ data_atendimento: "31/02/2026", unidade: "Leste" }));

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.error.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(["data_atendimento", "unidade"]),
    );
  });

  it("accepts a guide with no reception note and no CID", () => {
    const parsed = parseGuide(aGuideRecord({ cid: "", observacao_recepcao: "" }));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.value.guide.cid).toBeNull();
    expect(parsed.value.guide.receptionNote).toBeNull();
  });
});
