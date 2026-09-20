import { randomUUID } from "node:crypto";

import type {
  ApiUsageRepository,
  RecordApiRequestInput,
  UsageQuery,
} from "@/application/ports/api-usage-repository.port";
import { ANONYMOUS_CALLER } from "@/domain/access/api-usage";
import type { ApiRequestRecord, ApiUsageSummary } from "@/domain/access/api-usage";

interface StoredEvent extends RecordApiRequestInput {
  readonly id: string;
  readonly createdAt: Date;
}

/** Usage telemetry in memory, with the same shape the SQL version returns. */
export function createInMemoryApiUsageRepository(): ApiUsageRepository & {
  readonly events: readonly StoredEvent[];
} {
  const events: StoredEvent[] = [];

  const selected = (query: UsageQuery): StoredEvent[] =>
    events.filter(
      (event) =>
        event.createdAt >= query.since &&
        (query.surface === undefined || event.surface === query.surface),
    );

  return {
    events,

    record(input: RecordApiRequestInput): Promise<void> {
      events.push({ ...input, id: randomUUID(), createdAt: new Date() });
      return Promise.resolve();
    },

    summarize(query: UsageQuery): Promise<ApiUsageSummary> {
      const rows = selected(query);
      const total = rows.length;
      const countBy = (outcome: string): number =>
        rows.filter((row) => row.outcome === outcome).length;

      const routes = new Map<string, { requests: number; refused: number; ms: number }>();
      for (const row of rows) {
        const key = `${row.method} ${row.route}`;
        const current = routes.get(key) ?? { requests: 0, refused: 0, ms: 0 };
        routes.set(key, {
          requests: current.requests + 1,
          refused: current.refused + (row.outcome === "AUTHORIZED" ? 0 : 1),
          ms: current.ms + row.durationMs,
        });
      }

      return Promise.resolve({
        total,
        authorized: countBy("AUTHORIZED"),
        unauthorized: countBy("UNAUTHORIZED"),
        rateLimited: countBy("RATE_LIMITED"),
        averageMs:
          total === 0
            ? 0
            : Math.round(rows.reduce((sum, row) => sum + row.durationMs, 0) / total),
        daily: [],
        byRoute: [...routes.entries()].map(([key, value]) => {
          const [method = "", route = ""] = key.split(" ");
          return {
            method,
            route,
            requests: value.requests,
            refused: value.refused,
            averageMs: Math.round(value.ms / value.requests),
          };
        }),
        byCaller: [],
      });
    },

    listRecent(
      query: UsageQuery & { readonly limit: number },
    ): Promise<readonly ApiRequestRecord[]> {
      return Promise.resolve(
        selected(query)
          .toReversed()
          .slice(0, query.limit)
          .map((event) => ({
            id: event.id,
            surface: event.surface,
            method: event.method,
            route: event.route,
            status: event.status,
            outcome: event.outcome,
            durationMs: event.durationMs,
            createdAt: event.createdAt,
            caller: {
              label: event.credentialId ?? event.oauthClientId ?? ANONYMOUS_CALLER,
              kind:
                event.oauthClientId !== null
                  ? ("OAUTH" as const)
                  : event.credentialId !== null
                    ? ("API_KEY" as const)
                    : ("ANONYMOUS" as const),
              onBehalfOf: event.userId,
            },
          })),
      );
    },
  };
}
