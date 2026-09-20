import { z } from "zod";

import { toGuideListEntry } from "@/application/guides/guide-list-report";
import { listGuides } from "@/application/guides/list-guides.use-case";
import type { GuideListFilter } from "@/application/ports/guide-repository.port";
import { GUIDE_STATUSES } from "@/domain/guides/guide-status";
import { CLINIC_UNITS } from "@/domain/guides/guide.types";
import { importGuides } from "@/application/imports/import-guides.use-case";
import { serveMachineRequest } from "@/infrastructure/auth/api-guard";
import { toIsoDate } from "@/lib/dates";
import { appServices } from "@/infrastructure/composition-root";
import { problem, withProblemDetails } from "@/lib/api-problem";
import { MAX_BATCH_BODY_BYTES, readBoundedText } from "@/lib/request-body";

import { MAX_BATCH_SIZE, toBatch, toIngestionPayload } from "./ingest";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  status: z.enum(GUIDE_STATUSES).optional(),
  unit: z.enum(CLINIC_UNITS).optional(),
  convention: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
  from: z.string().refine((value) => toIsoDate(value) !== null, "use AAAA-MM-DD").optional(),
  through: z.string().refine((value) => toIsoDate(value) !== null, "use AAAA-MM-DD").optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

export async function GET(request: Request): Promise<Response> {
  return withProblemDetails(async () => {
    const services = await appServices();

    return serveMachineRequest(request, "REST", "/api/v1/guides", services, async () => {

    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));

    if (!parsed.success) {
      return problem(
        "INVALID_PAYLOAD",
        "Parâmetros de busca inválidos.",
        parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      );
    }

    const { status, unit, convention, search, from, through, limit } = parsed.data;
    const fromDate = from === undefined ? null : toIsoDate(from);
    const throughDate = through === undefined ? null : toIsoDate(through);

    const filter: GuideListFilter = {
      ...(status === undefined ? {} : { status }),
      ...(unit === undefined ? {} : { unit }),
      ...(convention === undefined ? {} : { conventionName: convention }),
      ...(search === undefined ? {} : { search }),
      ...(fromDate === null ? {} : { from: fromDate }),
      ...(throughDate === null ? {} : { through: throughDate }),
      ...(limit === undefined ? {} : { limit }),
    };

    const items = await listGuides(filter, services.guides);

    return Response.json({
      total: items.length,
      guides: items.map(toGuideListEntry),
    });
    });
  });
}

const INGEST_RATE_LIMIT = { limit: 30, windowMs: 60_000 } as const;

/**
 * Ingestion by API: the clinic's own system pushes guides in and gets the
 * decisions back in the same response.
 *
 * It goes through `importGuides`, the one write path, so provenance,
 * versioning by content and validation behave exactly as they do for a CSV
 * upload. A row that cannot be parsed is reported with its reason and never
 * aborts the rest of the batch.
 *
 * Writing needs a credential issued with the write scope: a key that only
 * reads gets 403 here, which is a different answer from "no key at all".
 */
export async function POST(request: Request): Promise<Response> {
  return withProblemDetails(async () => {
    const services = await appServices();

    return serveMachineRequest(
      request,
      "REST",
      "/api/v1/guides",
      services,
      async (caller) => {
        const body = await readBoundedText(request, MAX_BATCH_BODY_BYTES);

        if (!body.ok) {
          return body.error === "TOO_LARGE"
            ? problem("PAYLOAD_TOO_LARGE", "O corpo da requisição excede o limite permitido.")
            : problem("INVALID_JSON", "Não foi possível ler o corpo da requisição.");
        }

        let payload: unknown;
        try {
          payload = JSON.parse(body.value);
        } catch {
          return problem("INVALID_JSON", "O corpo da requisição não é um JSON válido.");
        }

        const batch = toBatch(payload);

        if (batch === null) {
          return problem(
            "INVALID_PAYLOAD",
            "Envie um objeto com os campos da guia, ou um array desses objetos.",
          );
        }

        if (batch.length === 0) {
          return problem("INVALID_PAYLOAD", "O lote está vazio.");
        }

        if (batch.length > MAX_BATCH_SIZE) {
          return problem(
            "PAYLOAD_TOO_LARGE",
            `Envie no máximo ${MAX_BATCH_SIZE} guias por chamada.`,
          );
        }

        const outcome = await importGuides(
          { records: batch, source: "API", fileName: null, fileHash: null },
          services,
        );

        await services.access.recordAuditEvent({
          action: "GUIDES_IMPORTED",
          actorKind: "API_KEY",
          actorUserId: null,
          subject: outcome.importId,
          metadata: {
            received: batch.length,
            imported: outcome.imported.length,
            rejected: outcome.rejected.length,
            credential: caller.credentialId ?? "ambiente",
          },
        });

        return Response.json(toIngestionPayload(outcome, batch.length), {
          status: outcome.rejected.length === 0 ? 201 : 207,
        });
      },
      { scope: "WRITE", rule: INGEST_RATE_LIMIT },
    );
  });
}
