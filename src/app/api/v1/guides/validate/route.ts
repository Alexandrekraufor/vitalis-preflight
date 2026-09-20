import { toValidationReport } from "@/application/guides/validation-report";
import { validateGuide } from "@/application/guides/validate-guide.use-case";
import type { RawGuideRecord } from "@/domain/normalization/normalization.types";
import { authenticateValidationRequest } from "@/infrastructure/auth/api-credentials";
import { appServices } from "@/infrastructure/composition-root";
import {
  problem,
  rateLimited,
  unauthorized,
  withProblemDetails,
} from "@/lib/api-problem";
import { clientKey, consumeRateLimit } from "@/lib/rate-limit";
import { MAX_JSON_BODY_BYTES, readBoundedText } from "@/lib/request-body";

export const dynamic = "force-dynamic";

const RATE_LIMIT = { limit: 60, windowMs: 60_000 } as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates a single guide sent in the CSV's own column names.
 *
 * **This endpoint computes a decision. It does not ingest anything.** No guide
 * row is created, updated or versioned by calling it, so an integrator can
 * check a guide as often as they like without touching the clinic's operational
 * data. Ingestion has its own path (`importGuides`, used by the CSV upload and
 * the seed) and its own authorization.
 *
 * What it does persist is one audit line — who asked, for which guide id, and
 * what came back — because "somebody ran the validator" is itself worth being
 * able to reconstruct. That is telemetry about a request, not a change to a
 * guide.
 *
 * Status codes follow what actually happened: 400/422 when the payload cannot
 * be turned into a guide at all, and 200 when the preflight ran — including
 * when it found problems, because finding problems is this endpoint working.
 */
export async function POST(request: Request): Promise<Response> {
  return withProblemDetails(async () => {
    const throttle = consumeRateLimit(clientKey(request, "validate"), RATE_LIMIT);
    if (!throttle.allowed) return rateLimited(throttle.retryAfterSeconds);

    const auth = authenticateValidationRequest(request);
    if (!auth.ok) return unauthorized();

    const body = await readBoundedText(request, MAX_JSON_BODY_BYTES);

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

    if (!isRecord(payload)) {
      return problem(
        "INVALID_PAYLOAD",
        "Envie um objeto com os campos da guia, usando os nomes de coluna do CSV.",
      );
    }

    const services = await appServices();

    // Unknown properties are ignored rather than rejected: the parser reads the
    // 18 columns it knows and nothing else, so an integrator sending extra
    // fields gets a validation, not an error — and cannot reach anything.
    const validated = await validateGuide(payload as RawGuideRecord, services);

    if (!validated.ok) {
      return problem(
        "UNPROCESSABLE_GUIDE",
        "A guia não pôde ser interpretada. Corrija os campos indicados.",
        validated.error,
      );
    }

    const { result, normalizations } = validated.value;

    await services.access.recordAuditEvent({
      action: "GUIDE_VALIDATION_REQUESTED",
      actorKind: auth.mode === "DEMO" ? "SYSTEM" : "API_KEY",
      actorUserId: null,
      subject: result.guide.idGuia,
      metadata: { decision: result.decision.status, mode: auth.mode },
    });

    return Response.json(toValidationReport(result, normalizations));
  });
}
