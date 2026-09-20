/**
 * Uniform error envelope for every machine-facing surface.
 *
 * Internal exception details never cross this boundary: callers get a stable
 * code and a sentence they can show a user, and the stack stays in the logs.
 */
export interface ApiProblem {
  readonly error: {
    readonly code: ApiProblemCode;
    readonly message: string;
    readonly details?: readonly { readonly field: string; readonly message: string }[];
  };
}

export type ApiProblemCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_JSON"
  | "INVALID_PAYLOAD"
  | "UNPROCESSABLE_GUIDE"
  | "INVALID_FILE"
  | "PAYLOAD_TOO_LARGE"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Readonly<Record<ApiProblemCode, number>> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INVALID_JSON: 400,
  INVALID_PAYLOAD: 400,
  UNPROCESSABLE_GUIDE: 422,
  INVALID_FILE: 422,
  PAYLOAD_TOO_LARGE: 413,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export function problem(
  code: ApiProblemCode,
  message: string,
  details?: readonly { readonly field: string; readonly message: string }[],
  headers?: Readonly<Record<string, string>>,
): Response {
  const body: ApiProblem = {
    error: details === undefined ? { code, message } : { code, message, details },
  };

  return Response.json(body, {
    status: STATUS_BY_CODE[code],
    ...(headers === undefined ? {} : { headers }),
  });
}

/**
 * The same answer for a missing credential and a wrong one.
 *
 * `WWW-Authenticate` tells an honest integrator what to send; the body says
 * nothing about whether a key is configured, so probing cannot map the surface.
 */
export function unauthorizedWithResourceMetadata(resourceMetadataUrl: string): Response {
  return problem(
    "UNAUTHORIZED",
    "Credencial ausente ou inválida. Autorize o acesso ou envie uma chave válida.",
    undefined,
    {
      "WWW-Authenticate": `Bearer realm="vitalis-preflight", resource_metadata="${resourceMetadataUrl}"`,
    },
  );
}

export function unauthorized(): Response {
  return problem(
    "UNAUTHORIZED",
    "Credencial ausente ou inválida. Envie o header Authorization: Bearer <token>.",
    undefined,
    { "WWW-Authenticate": 'Bearer realm="vitalis-preflight"' },
  );
}

export function forbidden(message = "Você não tem permissão para esta operação."): Response {
  return problem("FORBIDDEN", message);
}

export function rateLimited(retryAfterSeconds: number): Response {
  return problem(
    "RATE_LIMITED",
    "Muitas requisições. Tente novamente em instantes.",
    undefined,
    { "Retry-After": String(retryAfterSeconds) },
  );
}

/**
 * Wraps a handler so an unexpected throw becomes a 500 with no internals
 * leaked, while expected outcomes keep the status their handler chose.
 *
 * The message, the stack and the cause stay on the server. Nothing about the
 * database, the filesystem or the query reaches the caller.
 */
export async function withProblemDetails(
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    return await handler();
  } catch (error: unknown) {
    console.error("[api] unhandled error", error);
    return problem(
      "INTERNAL_ERROR",
      "Não foi possível processar a requisição. Tente novamente.",
    );
  }
}
