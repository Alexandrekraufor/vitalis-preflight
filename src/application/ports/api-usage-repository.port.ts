import type { ApiSurface } from "@/domain/access/api-credential";
import type {
  ApiRequestRecord,
  ApiUsageSummary,
  RequestOutcome,
} from "@/domain/access/api-usage";

export interface RecordApiRequestInput {
  readonly surface: ApiSurface;
  readonly method: string;
  /** Route pattern, so one busy guide does not become a thousand distinct rows. */
  readonly route: string;
  readonly status: number;
  readonly outcome: RequestOutcome;
  readonly durationMs: number;
  readonly credentialId: string | null;
  readonly oauthClientId: string | null;
  readonly userId: string | null;
}

export interface UsageQuery {
  readonly since: Date;
  readonly surface?: ApiSurface;
}

/**
 * The usage log for the machine-facing surfaces.
 *
 * Kept apart from `AccessRepository` because it is append-only telemetry with
 * a different lifecycle: it is written on every request and read only by the
 * integrations screen.
 */
export interface ApiUsageRepository {
  record(input: RecordApiRequestInput): Promise<void>;
  summarize(query: UsageQuery): Promise<ApiUsageSummary>;
  listRecent(query: UsageQuery & { readonly limit: number }): Promise<readonly ApiRequestRecord[]>;
}
