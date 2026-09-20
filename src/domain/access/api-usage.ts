import type { ApiSurface } from "./api-credential";

/**
 * What happened to a request on a machine-facing surface.
 *
 * Only these three outcomes exist because only these three matter to the
 * person reading the panel: it went through, it was refused, or it was
 * throttled.
 */
export const REQUEST_OUTCOMES = ["AUTHORIZED", "UNAUTHORIZED", "RATE_LIMITED"] as const;

export type RequestOutcome = (typeof REQUEST_OUTCOMES)[number];

const OUTCOME_LABELS: Readonly<Record<RequestOutcome, string>> = {
  AUTHORIZED: "Autorizada",
  UNAUTHORIZED: "Recusada",
  RATE_LIMITED: "Limitada",
};

export function requestOutcomeLabel(outcome: RequestOutcome): string {
  return OUTCOME_LABELS[outcome];
}

/** Who made the call, as far as the server could tell. */
export interface RequestCallerSummary {
  /** Credential name, application name or "anônimo". */
  readonly label: string;
  readonly kind: "API_KEY" | "OAUTH" | "ANONYMOUS";
  /** The person the call acted for, when it came through an authorization. */
  readonly onBehalfOf: string | null;
}

export interface ApiRequestRecord {
  readonly id: string;
  readonly surface: ApiSurface;
  readonly method: string;
  readonly route: string;
  readonly status: number;
  readonly outcome: RequestOutcome;
  readonly durationMs: number;
  readonly caller: RequestCallerSummary;
  readonly createdAt: Date;
}

export interface RouteUsage {
  readonly method: string;
  readonly route: string;
  readonly requests: number;
  readonly refused: number;
  readonly averageMs: number;
}

export interface CallerUsage {
  readonly label: string;
  readonly kind: RequestCallerSummary["kind"];
  readonly requests: number;
  readonly lastAt: Date;
}

export interface DailyUsage {
  /** `AAAA-MM-DD`, in the deployment's own day boundaries. */
  readonly day: string;
  readonly requests: number;
  readonly refused: number;
}

export interface ApiUsageSummary {
  readonly total: number;
  readonly authorized: number;
  readonly unauthorized: number;
  readonly rateLimited: number;
  readonly averageMs: number;
  readonly daily: readonly DailyUsage[];
  readonly byRoute: readonly RouteUsage[];
  readonly byCaller: readonly CallerUsage[];
}

export const ANONYMOUS_CALLER = "anônimo";
