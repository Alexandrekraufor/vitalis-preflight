import { z } from "zod";

import { toGuideListEntry } from "@/application/guides/guide-list-report";
import { listGuides } from "@/application/guides/list-guides.use-case";
import type { GuideListFilter } from "@/application/ports/guide-repository.port";
import { GUIDE_STATUSES } from "@/domain/guides/guide-status";
import { CLINIC_UNITS } from "@/domain/guides/guide.types";
import { guardMachineRequest } from "@/infrastructure/auth/api-guard";
import { appServices } from "@/infrastructure/composition-root";
import { problem, withProblemDetails } from "@/lib/api-problem";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  status: z.enum(GUIDE_STATUSES).optional(),
  unit: z.enum(CLINIC_UNITS).optional(),
  convention: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

export async function GET(request: Request): Promise<Response> {
  return withProblemDetails(async () => {
    const denied = guardMachineRequest(request, "REST");
    if (denied !== null) return denied;

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

    const { status, unit, convention, search, limit } = parsed.data;
    const filter: GuideListFilter = {
      ...(status === undefined ? {} : { status }),
      ...(unit === undefined ? {} : { unit }),
      ...(convention === undefined ? {} : { conventionName: convention }),
      ...(search === undefined ? {} : { search }),
      ...(limit === undefined ? {} : { limit }),
    };

    const { guides } = await appServices();
    const items = await listGuides(filter, guides);

    return Response.json({
      total: items.length,
      guides: items.map(toGuideListEntry),
    });
  });
}
