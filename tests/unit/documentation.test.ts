import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  GUIDE_EXAMPLE,
  INTERNAL_ENDPOINTS,
  REST_ENDPOINTS,
} from "@/components/integrations/rest-endpoint-catalog";
import { parseGuide } from "@/domain/guides/guide";
import { normalizeGuideRecord } from "@/domain/normalization/normalize-guide";

/** `/api/v1/guides/{id}` on screen is `app/api/v1/guides/[id]/route.ts` on disk. */
function routeFileFor(endpointPath: string): string {
  const segments = endpointPath
    .split("/")
    .filter((segment) => segment !== "")
    .map((segment) => (segment.startsWith("{") ? `[${segment.slice(1, -1)}]` : segment));

  return path.join(process.cwd(), "src", "app", ...segments, "route.ts");
}

describe("the documented API is the API that exists", () => {
  it("documents only endpoints that have a route", () => {
    for (const endpoint of [...REST_ENDPOINTS, ...INTERNAL_ENDPOINTS]) {
      expect(
        existsSync(routeFileFor(endpoint.path)),
        `sem rota para ${endpoint.method} ${endpoint.path}`,
      ).toBe(true);
    }
  });

  it("shows a payload the system actually accepts", () => {
    // If this parses, somebody copying the documentation gets a decision back
    // instead of a rejected row.
    const parsed = parseGuide(JSON.parse(GUIDE_EXAMPLE) as Record<string, unknown>);

    expect(parsed.ok, JSON.stringify(parsed.ok ? [] : parsed.error)).toBe(true);
  });

  it("shows a payload that exercises the normalisation it claims", () => {
    const outcome = normalizeGuideRecord(JSON.parse(GUIDE_EXAMPLE) as never);
    const changes = outcome.changes;

    // The example carries a Brazilian date and a comma decimal on purpose: the
    // response in the documentation shows those conversions.
    expect(changes.map((change) => change.field)).toContain("data_atendimento");
    expect(changes.map((change) => change.field)).toContain("valor");
  });

  it("gives every documented endpoint a request and a response to copy", () => {
    for (const endpoint of REST_ENDPOINTS) {
      expect(endpoint.request, `${endpoint.path} sem exemplo de requisição`).toBeDefined();
      expect(endpoint.response.length, `${endpoint.path} sem resposta`).toBeGreaterThan(10);
      expect(() => JSON.parse(endpoint.response)).not.toThrow();
    }
  });
});
