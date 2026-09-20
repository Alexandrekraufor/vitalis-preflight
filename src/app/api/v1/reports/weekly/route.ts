import { getPeriodReport } from "@/application/reports/get-period-report.use-case";
import { toPeriodReportPayload } from "@/application/reports/period-report-payload";
import { serveMachineRequest } from "@/infrastructure/auth/api-guard";
import { appServices } from "@/infrastructure/composition-root";
import { problem, withProblemDetails } from "@/lib/api-problem";
import { toIsoDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * The seven-day report: a shortcut for `GET /api/v1/reports?days=7`.
 *
 * It exists because "a semana" is the question the clinic actually asks, and
 * because integrators already point at this path. Filters and grouping live on
 * the general endpoint.
 */
export async function GET(request: Request): Promise<Response> {
  return withProblemDetails(async () => {
    const services = await appServices();

    return serveMachineRequest(
      request,
      "REST",
      "/api/v1/reports/weekly",
      services,
      async () => {
        const raw = new URL(request.url).searchParams.get("through");
        const through = raw === null ? null : toIsoDate(raw);

        if (raw !== null && through === null) {
          return problem("INVALID_PAYLOAD", "O parâmetro through deve ser uma data AAAA-MM-DD.");
        }

        const report = await getPeriodReport(
          services.guides,
          through === null ? { days: 7 } : { days: 7, through },
        );

        return report === null
          ? Response.json({ period: null, message: "Ainda não há guias validadas." })
          : Response.json(toPeriodReportPayload(report));
      },
    );
  });
}
