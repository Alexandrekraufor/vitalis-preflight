import { z } from "zod";

import { guardSessionRequest, isResponse } from "@/infrastructure/auth/api-guard";
import { appServices } from "@/infrastructure/composition-root";
import {
  exportPendingGuidesCsv,
  exportReadyGuidesCsv,
} from "@/infrastructure/csv/guide-csv.exporter";
import { problem, withProblemDetails } from "@/lib/api-problem";

export const dynamic = "force-dynamic";

const querySchema = z.object({ kind: z.enum(["ready", "pending"]) });

const FILE_NAMES = {
  ready: "guias-prontas-para-envio.csv",
  pending: "guias-com-pendencias.csv",
} as const;

/** Carla's two working files: what can go out, and what has to be fixed first. */
export async function GET(request: Request): Promise<Response> {
  return withProblemDetails(async () => {
    const services = await appServices();
    const guard = await guardSessionRequest(request, services.access, ["ADMIN", "MEMBER"]);
    if (isResponse(guard)) return guard;

    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));

    if (!parsed.success) {
      return problem("INVALID_PAYLOAD", "Use kind=ready ou kind=pending.");
    }

    const { kind } = parsed.data;

    const rows = await services.guides.listForExport(
      kind === "ready" ? { status: "READY_TO_SUBMIT" } : {},
    );

    const csv = kind === "ready" ? exportReadyGuidesCsv(rows) : exportPendingGuidesCsv(rows);

    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        // `attachment` with a fixed name: the browser saves the file instead of
        // rendering it, so a crafted cell can never execute in this origin.
        "content-disposition": `attachment; filename="${FILE_NAMES[kind]}"`,
        "x-content-type-options": "nosniff",
      },
    });
  });
}
