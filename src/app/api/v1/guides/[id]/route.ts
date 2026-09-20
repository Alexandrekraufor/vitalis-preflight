import { toGuideDetailReport } from "@/application/guides/guide-detail-report";
import { getGuide } from "@/application/guides/get-guide.use-case";
import { serveMachineRequest } from "@/infrastructure/auth/api-guard";
import { appServices } from "@/infrastructure/composition-root";
import { problem, withProblemDetails } from "@/lib/api-problem";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return withProblemDetails(async () => {
    const services = await appServices();

    return serveMachineRequest(request, "REST", "/api/v1/guides/{id}", services, async () => {

    const { id } = await context.params;
    const detail = await getGuide(id, services.guides);

    if (detail === null) {
      return problem("NOT_FOUND", `Guia ${id} não encontrada.`);
    }

    return Response.json(toGuideDetailReport(detail));
    });
  });
}
