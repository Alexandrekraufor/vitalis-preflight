import { isIsoDate } from "@/lib/dates";

import {
  GUIDE_COLUMNS,
  type GuideColumn,
  type NormalizationChange,
  type NormalizationOutcome,
  type NormalizedGuideRecord,
  type RawGuideRecord,
} from "./normalization.types";

const DATE_COLUMNS: readonly GuideColumn[] = [
  "data_atendimento",
  "autorizacao_validade",
  "data_lancamento",
];

const DECIMAL_COLUMNS: readonly GuideColumn[] = ["valor"];

const BRAZILIAN_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const COMMA_DECIMAL = /^-?\d+,\d{1,2}$/;

/**
 * Columns whose content is clinical, contractual or identifying. They are
 * trimmed, never rewritten: silently "fixing" a CID or an authorization number
 * would replace a visible error with an invisible one.
 */
function isRewritable(column: GuideColumn): boolean {
  return DATE_COLUMNS.includes(column) || DECIMAL_COLUMNS.includes(column);
}

function asText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** `03/08/2026` -> `2026-08-03`, only when the day/month pair is a real date. */
function toIsoFromBrazilianDate(value: string): string | null {
  const match = BRAZILIAN_DATE.exec(value);
  if (match === null) return null;

  const [, day, month, year] = match;
  const candidate = `${year}-${month}-${day}`;
  return isIsoDate(candidate) ? candidate : null;
}

/**
 * Repairs notation, never meaning. The result is paired with the list of edits
 * so the UI, the API and the audit trail can show exactly what was touched.
 */
export function normalizeGuideRecord(raw: RawGuideRecord): NormalizationOutcome {
  const changes: NormalizationChange[] = [];
  const record: Partial<Record<GuideColumn, string | null>> = {};

  for (const column of GUIDE_COLUMNS) {
    const original = asText(raw[column]);

    if (original === null) {
      record[column] = null;
      continue;
    }

    let current = collapseWhitespace(original);

    if (current !== original) {
      changes.push({
        field: column,
        kind: "TRIMMED_WHITESPACE",
        from: original,
        to: current,
        reason: "Espaços em excesso removidos.",
      });
    }

    if (current === "") {
      record[column] = null;
      if (original !== "") {
        changes.push({
          field: column,
          kind: "EMPTY_TO_NULL",
          from: original,
          to: null,
          reason: "Campo em branco tratado como ausente.",
        });
      }
      continue;
    }

    if (isRewritable(column)) {
      if (DATE_COLUMNS.includes(column)) {
        const isoDate = toIsoFromBrazilianDate(current);
        if (isoDate !== null) {
          changes.push({
            field: column,
            kind: "DATE_REFORMATTED",
            from: current,
            to: isoDate,
            reason: "Data no formato DD/MM/AAAA convertida para AAAA-MM-DD.",
          });
          current = isoDate;
        }
      }

      if (DECIMAL_COLUMNS.includes(column) && COMMA_DECIMAL.test(current)) {
        const withDot = current.replace(",", ".");
        changes.push({
          field: column,
          kind: "DECIMAL_SEPARATOR",
          from: current,
          to: withDot,
          reason: "Vírgula decimal convertida para ponto.",
        });
        current = withDot;
      }
    }

    record[column] = current;
  }

  return { record: record as NormalizedGuideRecord, changes };
}
