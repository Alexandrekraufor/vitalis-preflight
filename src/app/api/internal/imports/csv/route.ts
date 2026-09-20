import { createHash } from "node:crypto";

import { importGuides } from "@/application/imports/import-guides.use-case";
import { guardSessionRequest, isResponse } from "@/infrastructure/auth/api-guard";
import { appServices } from "@/infrastructure/composition-root";
import { parseGuideCsv } from "@/infrastructure/csv/guide-csv.parser";
import { problem, withProblemDetails } from "@/lib/api-problem";
import { MAX_CSV_BYTES } from "@/lib/request-body";

export const dynamic = "force-dynamic";

interface UploadedCsv {
  readonly contents: string;
  readonly fileName: string | null;
}

/**
 * Reads the upload, refusing anything past the size ceiling.
 *
 * `file.name` is used only as a label stored next to the import record - it
 * never touches the filesystem, so a crafted name cannot escape a directory.
 */
async function readUpload(request: Request): Promise<UploadedCsv | "TOO_LARGE" | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > MAX_CSV_BYTES) return "TOO_LARGE";

  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) return null;
  if (file.size > MAX_CSV_BYTES) return "TOO_LARGE";

  return { contents: await file.text(), fileName: file.name.slice(0, 255) };
}

/**
 * Ingestion: the one write path into operational guide data from the browser.
 *
 * It lives under `/api/internal` because it is reached with a session cookie by
 * a signed-in member, never with an API key. The external integration surface
 * (`/api/v1`) validates and reads; it does not ingest.
 */
export async function POST(request: Request): Promise<Response> {
  return withProblemDetails(async () => {
    const services = await appServices();
    const guard = await guardSessionRequest(request, services.access, ["ADMIN", "MEMBER"]);
    if (isResponse(guard)) return guard;

    const upload = await readUpload(request);

    if (upload === "TOO_LARGE") {
      return problem(
        "PAYLOAD_TOO_LARGE",
        `O arquivo excede o limite de ${Math.round(MAX_CSV_BYTES / 1024 / 1024)} MB.`,
      );
    }

    if (upload === null) {
      return problem("INVALID_FILE", "Envie um arquivo CSV no campo file.");
    }

    const parsed = parseGuideCsv(upload.contents);

    if (!parsed.ok) {
      return problem(
        "INVALID_FILE",
        parsed.error.line === null
          ? parsed.error.message
          : `Linha ${parsed.error.line}: ${parsed.error.message}`,
      );
    }

    const outcome = await importGuides(
      {
        records: parsed.value,
        source: "CSV",
        fileName: upload.fileName,
        fileHash: createHash("sha256").update(upload.contents, "utf8").digest("hex"),
      },
      services,
    );

    const byStatus = outcome.imported.reduce<Record<string, number>>(
      (counts, item) => ({
        ...counts,
        [item.validated.result.decision.status]:
          (counts[item.validated.result.decision.status] ?? 0) + 1,
      }),
      {},
    );

    await services.access.recordAuditEvent({
      action: "GUIDES_IMPORTED",
      actorKind: "SESSION",
      actorUserId: guard.user.id,
      subject: outcome.importId,
      metadata: {
        rows: parsed.value.length,
        imported: outcome.imported.length,
        rejected: outcome.rejected.length,
        newVersions: outcome.newVersions,
      },
    });

    return Response.json({
      importId: outcome.importId,
      imported: outcome.imported.length,
      rejected: outcome.rejected,
      newVersions: outcome.newVersions,
      automaticNormalizations: outcome.automaticNormalizations,
      readyToSubmit: byStatus["READY_TO_SUBMIT"] ?? 0,
      needsCorrection: byStatus["NEEDS_CORRECTION"] ?? 0,
      reviewRequired: byStatus["REVIEW_REQUIRED"] ?? 0,
    });
  });
}
