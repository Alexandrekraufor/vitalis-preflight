import "server-only";

import { and, avg, count, desc, eq, gte, sql } from "drizzle-orm";

import type {
  ApiUsageRepository,
  RecordApiRequestInput,
  UsageQuery,
} from "@/application/ports/api-usage-repository.port";
import { ANONYMOUS_CALLER } from "@/domain/access/api-usage";
import type {
  ApiRequestRecord,
  ApiUsageSummary,
  CallerUsage,
  DailyUsage,
  RouteUsage,
} from "@/domain/access/api-usage";

import type { Database } from "../client";
import { apiCredentials, users } from "../schema/access";
import { oauthClients } from "../schema/oauth";
import { apiRequestEvents } from "../schema/usage";

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function createDrizzleApiUsageRepository(database: Database): ApiUsageRepository {
  const scope = (query: UsageQuery) =>
    query.surface === undefined
      ? gte(apiRequestEvents.createdAt, query.since)
      : and(
          gte(apiRequestEvents.createdAt, query.since),
          eq(apiRequestEvents.surface, query.surface),
        );

  return {
    async record(input: RecordApiRequestInput): Promise<void> {
      await database.insert(apiRequestEvents).values({
        surface: input.surface,
        method: input.method,
        route: input.route,
        status: input.status,
        outcome: input.outcome,
        durationMs: input.durationMs,
        credentialId: input.credentialId,
        oauthClientId: input.oauthClientId,
        userId: input.userId,
      });
    },

    async summarize(query: UsageQuery): Promise<ApiUsageSummary> {
      const where = scope(query);

      const [totals] = await database
        .select({
          total: count(),
          authorized: sql<number>`count(*) filter (where ${apiRequestEvents.outcome} = 'AUTHORIZED')`,
          unauthorized: sql<number>`count(*) filter (where ${apiRequestEvents.outcome} = 'UNAUTHORIZED')`,
          rateLimited: sql<number>`count(*) filter (where ${apiRequestEvents.outcome} = 'RATE_LIMITED')`,
          averageMs: avg(apiRequestEvents.durationMs),
        })
        .from(apiRequestEvents)
        .where(where);

      const daily = await database
        .select({
          day: sql<string>`to_char(date_trunc('day', ${apiRequestEvents.createdAt}), 'YYYY-MM-DD')`,
          requests: count(),
          refused: sql<number>`count(*) filter (where ${apiRequestEvents.outcome} <> 'AUTHORIZED')`,
        })
        .from(apiRequestEvents)
        .where(where)
        .groupBy(sql`date_trunc('day', ${apiRequestEvents.createdAt})`)
        .orderBy(sql`date_trunc('day', ${apiRequestEvents.createdAt})`);

      const byRoute = await database
        .select({
          method: apiRequestEvents.method,
          route: apiRequestEvents.route,
          requests: count(),
          refused: sql<number>`count(*) filter (where ${apiRequestEvents.outcome} <> 'AUTHORIZED')`,
          averageMs: avg(apiRequestEvents.durationMs),
        })
        .from(apiRequestEvents)
        .where(where)
        .groupBy(apiRequestEvents.method, apiRequestEvents.route)
        .orderBy(desc(count()))
        .limit(10);

      const byCaller = await database
        .select({
          credentialName: apiCredentials.name,
          clientName: oauthClients.name,
          requests: count(),
          lastAt: sql<Date>`max(${apiRequestEvents.createdAt})`,
        })
        .from(apiRequestEvents)
        .leftJoin(apiCredentials, eq(apiRequestEvents.credentialId, apiCredentials.id))
        .leftJoin(oauthClients, eq(apiRequestEvents.oauthClientId, oauthClients.id))
        .where(where)
        .groupBy(apiCredentials.name, oauthClients.name)
        .orderBy(desc(count()))
        .limit(10);

      return {
        total: toNumber(totals?.total),
        authorized: toNumber(totals?.authorized),
        unauthorized: toNumber(totals?.unauthorized),
        rateLimited: toNumber(totals?.rateLimited),
        averageMs: Math.round(toNumber(totals?.averageMs)),
        daily: daily.map(
          (row): DailyUsage => ({
            day: row.day,
            requests: toNumber(row.requests),
            refused: toNumber(row.refused),
          }),
        ),
        byRoute: byRoute.map(
          (row): RouteUsage => ({
            method: row.method,
            route: row.route,
            requests: toNumber(row.requests),
            refused: toNumber(row.refused),
            averageMs: Math.round(toNumber(row.averageMs)),
          }),
        ),
        byCaller: byCaller.map((row): CallerUsage => {
          const label = row.clientName ?? row.credentialName ?? ANONYMOUS_CALLER;
          return {
            label,
            kind:
              row.clientName !== null
                ? "OAUTH"
                : row.credentialName !== null
                  ? "API_KEY"
                  : "ANONYMOUS",
            requests: toNumber(row.requests),
            lastAt: new Date(row.lastAt),
          };
        }),
      };
    },

    async listRecent(
      query: UsageQuery & { readonly limit: number },
    ): Promise<readonly ApiRequestRecord[]> {
      const rows = await database
        .select({
          id: apiRequestEvents.id,
          surface: apiRequestEvents.surface,
          method: apiRequestEvents.method,
          route: apiRequestEvents.route,
          status: apiRequestEvents.status,
          outcome: apiRequestEvents.outcome,
          durationMs: apiRequestEvents.durationMs,
          createdAt: apiRequestEvents.createdAt,
          credentialName: apiCredentials.name,
          clientName: oauthClients.name,
          userName: users.name,
        })
        .from(apiRequestEvents)
        .leftJoin(apiCredentials, eq(apiRequestEvents.credentialId, apiCredentials.id))
        .leftJoin(oauthClients, eq(apiRequestEvents.oauthClientId, oauthClients.id))
        .leftJoin(users, eq(apiRequestEvents.userId, users.id))
        .where(scope(query))
        .orderBy(desc(apiRequestEvents.createdAt))
        .limit(query.limit);

      return rows.map(
        (row): ApiRequestRecord => ({
          id: row.id,
          surface: row.surface,
          method: row.method,
          route: row.route,
          status: row.status,
          outcome: row.outcome,
          durationMs: row.durationMs,
          createdAt: row.createdAt,
          caller: {
            label: row.clientName ?? row.credentialName ?? ANONYMOUS_CALLER,
            kind:
              row.clientName !== null
                ? "OAUTH"
                : row.credentialName !== null
                  ? "API_KEY"
                  : "ANONYMOUS",
            onBehalfOf: row.userName,
          },
        }),
      );
    },
  };
}
