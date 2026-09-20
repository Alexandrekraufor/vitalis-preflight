import {
  GUIDE_COLUMNS,
  type GuideColumn,
  type RawGuideRecord,
} from "@/domain/normalization/normalization.types";
import { err, ok, type Result } from "@/lib/result";

export interface CsvParseError {
  readonly message: string;
  /** 1-based line in the uploaded file, when the problem is local to one row. */
  readonly line: number | null;
}

/**
 * RFC 4180 field splitter: quoted fields may contain commas, newlines and
 * doubled quotes. The clinic's export does use quoted notes, so a naive
 * `split(",")` would silently shift every column after a note.
 */
function splitRows(contents: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const endField = (): void => {
    row.push(field);
    field = "";
  };

  const endRow = (): void => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index];

    if (inQuotes) {
      if (character === '"') {
        if (contents[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    switch (character) {
      case '"':
        inQuotes = true;
        break;
      case ",":
        endField();
        break;
      case "\r":
        break;
      case "\n":
        endRow();
        break;
      default:
        field += character;
    }
  }

  if (field !== "" || row.length > 0) endRow();

  return rows;
}

function isBlankRow(row: readonly string[]): boolean {
  return row.every((cell) => cell.trim() === "");
}

/**
 * Turns an upload into raw records. It checks the shape of the file only —
 * values are handed to the normalizer and the rule engine untouched, so a CSV
 * import and an API call converge on exactly the same code path.
 */
export function parseGuideCsv(
  contents: string,
): Result<readonly RawGuideRecord[], CsvParseError> {
  const withoutBom = contents.replace(/^﻿/, "");
  const rows = splitRows(withoutBom).filter((row) => !isBlankRow(row));
  const header = rows[0];

  if (header === undefined) {
    return err({ message: "Arquivo vazio.", line: null });
  }

  const headerColumns = header.map((cell) => cell.trim().toLowerCase());
  const missing = GUIDE_COLUMNS.filter((column) => !headerColumns.includes(column));

  if (missing.length > 0) {
    return err({
      message: `Colunas ausentes no cabeçalho: ${missing.join(", ")}.`,
      line: 1,
    });
  }

  const records: RawGuideRecord[] = [];

  for (const [offset, row] of rows.slice(1).entries()) {
    const line = offset + 2;

    if (row.length !== header.length) {
      return err({
        message: `A linha tem ${row.length} colunas e o cabeçalho tem ${header.length}.`,
        line,
      });
    }

    const record: Partial<Record<GuideColumn, string>> = {};
    for (const column of GUIDE_COLUMNS) {
      record[column] = row[headerColumns.indexOf(column)] ?? "";
    }
    records.push(record);
  }

  if (records.length === 0) {
    return err({ message: "O arquivo não contém nenhuma guia.", line: null });
  }

  return ok(records);
}
