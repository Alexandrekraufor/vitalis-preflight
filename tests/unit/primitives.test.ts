import { describe, expect, it } from "vitest";

import {
  addDays,
  compareIsoDates,
  daysBetween,
  formatBrazilianDate,
  isIsoDate,
  toIsoDate,
} from "@/lib/dates";
import { formatBrl, fromCents, parseMoney, sum, toDecimalString } from "@/lib/money";
import { parseGuideCsv } from "@/infrastructure/csv/guide-csv.parser";
import { GUIDE_COLUMNS } from "@/domain/normalization/normalization.types";

describe("dates", () => {
  it("accepts real calendar dates only", () => {
    expect(isIsoDate("2026-08-31")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(toIsoDate("31/02/2026")).toBeNull();
  });

  it("compares chronologically", () => {
    const earlier = toIsoDate("2026-08-04");
    const later = toIsoDate("2026-08-19");
    expect(earlier).not.toBeNull();
    expect(later).not.toBeNull();
    if (earlier === null || later === null) return;

    expect(compareIsoDates(earlier, later)).toBe(-1);
    expect(compareIsoDates(later, earlier)).toBe(1);
    expect(compareIsoDates(earlier, earlier)).toBe(0);
    expect(daysBetween(earlier, later)).toBe(15);
    expect(addDays(earlier, 15)).toBe(later);
    expect(formatBrazilianDate(earlier)).toBe("04/08/2026");
  });
});

describe("money", () => {
  it("parses both decimal separators to the same cents", () => {
    expect(parseMoney("62.00")).toBe(6200);
    expect(parseMoney("62,00")).toBe(6200);
    expect(parseMoney("62")).toBe(6200);
    expect(parseMoney("140.5")).toBe(14050);
  });

  it("rejects anything that is not an unambiguous amount", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("R$ 62,00")).toBeNull();
    expect(parseMoney("62.000")).toBeNull();
    expect(parseMoney("1.234,56")).toBeNull();
  });

  it("round-trips through the database representation", () => {
    expect(toDecimalString(fromCents(6200))).toBe("62.00");
    expect(toDecimalString(fromCents(5))).toBe("0.05");
    expect(formatBrl(fromCents(14000))).toBe("R$ 140,00");
  });

  it("sums without floating point drift", () => {
    const cents = Array.from({ length: 3 }, () => fromCents(6200));
    expect(sum(cents)).toBe(18600);
    expect(toDecimalString(sum(cents))).toBe("186.00");
  });

  it("refuses a fractional number of cents", () => {
    expect(() => fromCents(62.5)).toThrow(TypeError);
  });
});

describe("CSV parser", () => {
  const HEADER = GUIDE_COLUMNS.join(",");

  function row(note: string): string {
    return [
      "G-1",
      "Centro",
      "2026-08-20",
      "P-1",
      "Vitalcard",
      "884410270",
      "M79.7",
      "50000470",
      "Sessão",
      "AUT1",
      "2026-08-31",
      "10",
      "3",
      "Bruno",
      "CREFITO-3 1-F",
      "62.00",
      note,
      "2026-08-21",
    ].join(",");
  }

  it("keeps commas inside a quoted reception note", () => {
    const parsed = parseGuideCsv(`${HEADER}\n${row('"Trouxe exame novo, anexado."')}\n`);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.value[0]?.observacao_recepcao).toBe("Trouxe exame novo, anexado.");
  });

  it("unescapes doubled quotes", () => {
    const parsed = parseGuideCsv(`${HEADER}\n${row('"Disse ""urgente"" na recepção."')}\n`);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.value[0]?.observacao_recepcao).toBe('Disse "urgente" na recepção.');
  });

  it("tolerates a BOM and CRLF line endings", () => {
    const parsed = parseGuideCsv(`﻿${HEADER}\r\n${row("")}\r\n`);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.value[0]?.id_guia).toBe("G-1");
  });

  it("rejects an empty file", () => {
    expect(parseGuideCsv("")).toMatchObject({ ok: false, error: { message: "Arquivo vazio." } });
  });

  it("rejects a header missing columns", () => {
    const parsed = parseGuideCsv("id_guia,unidade\nG-1,Centro\n");

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.error.message).toContain("Colunas ausentes");
    expect(parsed.error.line).toBe(1);
  });

  it("points at the row whose column count does not match", () => {
    const parsed = parseGuideCsv(`${HEADER}\n${row("")}\nG-2,Centro\n`);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.error.line).toBe(3);
  });

  it("rejects a file with a header and no guides", () => {
    const parsed = parseGuideCsv(`${HEADER}\n`);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;

    expect(parsed.error.message).toContain("nenhuma guia");
  });
});
