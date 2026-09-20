import type { GuideExportRow } from "@/application/ports/guide-repository.port";
import { guideStatusLabel } from "@/domain/guides/guide-status";
import { GUIDE_COLUMNS } from "@/domain/normalization/normalization.types";
import { toDecimalString } from "@/lib/money";

/**
 * Characters that make a spreadsheet treat a cell as a formula rather than as
 * text. A reception note beginning with `=` is data, but Excel and Sheets will
 * happily evaluate it — and `=HYPERLINK`, `=WEBSERVICE` or a DDE payload turns
 * an exported worklist into an exfiltration channel.
 */
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

/**
 * Neutralizes a value for a spreadsheet without altering what it says.
 *
 * A leading apostrophe is the conventional escape: Excel and Sheets strip it on
 * display and never evaluate what follows, so the reader still sees the note
 * exactly as the receptionist typed it.
 */
function defuseFormula(text: string): string {
  return FORMULA_TRIGGERS.test(text) ? `'${text}` : text;
}

function escapeCell(value: string | null): string {
  const text = defuseFormula(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(header: readonly string[], rows: readonly (readonly (string | null)[])[]): string {
  return [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n") + "\r\n";
}

/**
 * Guides cleared for submission, in the clinic's own 18-column layout so the
 * file can be fed straight back into the management system.
 */
export function exportReadyGuidesCsv(rows: readonly GuideExportRow[]): string {
  return toCsv(
    GUIDE_COLUMNS,
    rows
      .filter((row) => row.status === "READY_TO_SUBMIT")
      .map((row) => GUIDE_COLUMNS.map((column) => row.record[column])),
  );
}

const PENDING_HEADER = [
  "id_guia",
  "unidade",
  "convenio",
  "paciente",
  "data_atendimento",
  "valor",
  "status",
  "valor_em_risco",
  "codigo",
  "gravidade",
  "campo",
  "problema",
  "esperado",
  "encontrado",
  "acao_recomendada",
] as const;

/**
 * The correction worklist: one line per problem, not per guide, because the
 * reception works through problems rather than through guides.
 */
export function exportPendingGuidesCsv(rows: readonly GuideExportRow[]): string {
  const lines = rows
    .filter((row) => row.status !== "READY_TO_SUBMIT")
    .flatMap((row) =>
      row.findings
        .filter((finding) => finding.severity !== "INFO")
        .map((finding) => [
          row.record.id_guia,
          row.record.unidade,
          row.record.convenio,
          row.record.paciente,
          row.record.data_atendimento,
          row.record.valor,
          guideStatusLabel(row.status),
          toDecimalString(row.amountAtRisk),
          finding.code,
          finding.severity,
          finding.field,
          finding.message,
          finding.expected,
          finding.actual,
          finding.recommendedAction,
        ]),
    );

  return toCsv(PENDING_HEADER, lines);
}
