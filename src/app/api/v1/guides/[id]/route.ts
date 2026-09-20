import { toGuideDetailReport } from "@/application/guides/guide-detail-report";
import { getGuide } from "@/application/guides/get-guide.use-case";
import { guardMachineRequest } from "@/infrastructure/auth/api-guard";
import { appServices } from "@/infrastructure/composition-root";
import { problem, withProblemDetails } from "@/lib/api-problem";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return withProblemDetails(async () => {
    const denied = guardMachineRequest(request, "REST");
    if (denied !== null) return denied;

    const { id } = await context.params;
    const { guides } = await appServices();
    const detail = await getGuide(id, guides);

    if (detail === null) {
      return problem("NOT_FOUND", `Guia ${id} não encontrada.`);
    }

    return Response.json(toGuideDetailReport(detail));
  });
}
