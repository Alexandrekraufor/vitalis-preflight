import { sql } from "drizzle-orm";

import { db } from "@/infrastructure/db/client";
import { loadRuleSet } from "@/infrastructure/rules/file-rule-set.repository";

export const dynamic = "force-dynamic";

/**
 * Liveness only.
 *
 * This endpoint is unauthenticated, so it says whether the service is up and
 * nothing else: the rule set version and hash are operational detail and now
 * live behind the dashboard and the authenticated API.
 */
export async function GET(): Promise<Response> {
  const [database, rules] = await Promise.allSettled([
    db().execute(sql`select 1`),
    loadRuleSet(),
  ]);

  const healthy = database.status === "fulfilled" && rules.status === "fulfilled";

  return Response.json(
    {
      status: healthy ? "ok" : "degraded",
      database: database.status === "fulfilled" ? "up" : "down",
      rules: rules.status === "fulfilled" ? "loaded" : "unavailable",
      checkedAt: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
