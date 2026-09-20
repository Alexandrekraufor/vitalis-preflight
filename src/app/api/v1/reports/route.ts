import { z } from "zod";

import {
  MAX_PERIOD_DAYS,
  getPeriodReport,
  type ReportQuery,
} from "@/application/reports/get-period-report.use-case";
import { toPeriodReportPayload } from "@/application/reports/period-report-payload";
import { CLINIC_UNITS } from "@/domain/guides/guide.types";
import { serveMachineRequest } from "@/infrastructure/auth/api-guard";
import { appServices } from "@/infrastructure/composition-root";
import { problem, withProblemDetails } from "@/lib/api-problem";
import { toIsoDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

const GROUPS = ["unit", "convention"] as const;

/** A grouped call fans out into one report per slice, so the cost is bounded. */
const MAX_GROUPS = 20;

const querySchema = z.object({
  days: z.coerce.number().int().positive().max(MAX_PERIOD_DAYS).optional(),
  from: z.string().optional(),
  through: z.string().optional(),
  unit: z.enum(CLINIC_UNITS).optional(),
  convention: z.string().min(1).optional(),
  group_by: z.enum(GROUPS).optional(),
});

/**
 * The executive report, for any window and any slice.
 *
 * One call answers for the whole clinic, for one unit, for one convention, or
 * for all of them at once through `group_by`. Every slice carries its own
 * comparison against the preceding window of the same length, which is what
 * makes an array of reports usable without the caller redoing arithmetic.
 */
export async function GET(request: Request): Promise<Response> {
  return withProblemDetails(async () => {
    const services = await appServices();

    return serveMachineRequest(request, "REST", "/api/v1/reports", services, async () => {
      const url = new URL(request.url);
      const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));

      if (!parsed.success) {
        return problem(
          "INVALID_PAYLOAD",
          "Parâmetros inválidos.",
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        );
      }

      const { days, from, through, unit, convention, group_by: groupBy } = parsed.data;
      const fromDate = from === undefined ? null : toIsoDate(from);
      const throughDate = through === undefined ? null : toIsoDate(through);

      if ((from !== undefined && fromDate === null) || (through !== undefined && throughDate === null)) {
        return problem("INVALID_PAYLOAD", "As datas devem estar em AAAA-MM-DD.");
      }

      const base: ReportQuery = {
        ...(days === undefined ? {} : { days }),
        ...(fromDate === null ? {} : { from: fromDate }),
        ...(throughDate === null ? {} : { through: throughDate }),
        ...(unit === undefined ? {} : { unit }),
        ...(convention === undefined ? {} : { convention }),
      };

      if (groupBy === undefined) {
        const report = await getPeriodReport(services.guides, base);

        return report === null
          ? Response.json({ period: null, message: "Ainda não há guias validadas." })
          : Response.json(toPeriodReportPayload(report));
      }

      const slices =
        groupBy === "unit"
          ? CLINIC_UNITS.map((value) => ({ unit: value }))
          : [...services.ruleSet.conventions.values()]
              .slice(0, MAX_GROUPS)
              .map((entry) => ({ convention: entry.name }));

      const reports = await Promise.all(
        slices.map((slice) => getPeriodReport(services.guides, { ...base, ...slice })),
      );

      const present = reports.filter((report) => report !== null);

      return Response.json({
        groupBy,
        reports: present.map(toPeriodReportPayload),
      });
    });
  });
}
