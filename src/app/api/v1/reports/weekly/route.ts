import { z } from "zod";

import { getWeeklyReport } from "@/application/reports/get-weekly-report.use-case";
import { toIsoDate } from "@/lib/dates";
import { guardMachineRequest } from "@/infrastructure/auth/api-guard";
import { appServices } from "@/infrastructure/composition-root";
import { problem, withProblemDetails } from "@/lib/api-problem";
import { toDecimalString } from "@/lib/money";

export const dynamic = "force-dynamic";

const querySchema = z.object({ through: z.string().optional() });

export async function GET(request: Request): Promise<Response> {
  return withProblemDetails(async () => {
    const denied = guardMachineRequest(request, "REST");
    if (denied !== null) return denied;

    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    const rawThrough = parsed.success ? parsed.data.through : undefined;
    const through = rawThrough === undefined ? undefined : toIsoDate(rawThrough);

    if (rawThrough !== undefined && through === null) {
      return problem("INVALID_PAYLOAD", "O parâmetro through deve ser uma data AAAA-MM-DD.");
    }

    const { guides } = await appServices();
    const report = await getWeeklyReport(
      guides,
      through === null || through === undefined ? {} : { through },
    );

    if (report === null) {
      return Response.json({ period: null, message: "Ainda não há guias validadas." });
    }

    return Response.json({
      period: report.period,
      problemShare: report.problemShare,
      summary: {
        ...report.summary,
        amountAtRisk: Number(toDecimalString(report.summary.amountAtRisk)),
        amountProtected: Number(toDecimalString(report.summary.amountProtected)),
        topProblems: report.summary.topProblems.map((problemCount) => ({
          ...problemCount,
          amountAtRisk: Number(toDecimalString(problemCount.amountAtRisk)),
        })),
        byUnit: report.summary.byUnit.map((unit) => ({
          ...unit,
          amountAtRisk: Number(toDecimalString(unit.amountAtRisk)),
        })),
      },
      previous:
        report.previous === null
          ? null
          : {
              ...report.previous,
              amountAtRisk: Number(toDecimalString(report.previous.amountAtRisk)),
            },
    });
  });
}
