import { beforeEach } from "vitest";

import { resetRateLimits } from "@/lib/rate-limit";

/**
 * Environment for the test process.
 *
 * These are fixtures, not credentials: they never leave this file, and the
 * database URL points at a host the suite never connects to — every test runs
 * against in-memory repositories.
 */
// `NODE_ENV` is typed read-only by @types/node; Vitest already sets it to
// "test", so it only needs a cast when something else has to override it.
process.env["DATABASE_URL"] ??= "postgres://test:test@127.0.0.1:1/vitalis_test";
process.env["APP_URL"] ??= "http://localhost:3000";
process.env["VITALIS_API_KEY"] ??= "test-rest-key-0000000000000000000000";
process.env["VITALIS_MCP_API_KEY"] ??= "test-mcp-key-00000000000000000000000";
process.env["VITALIS_API_DEMO_MODE"] ??= "false";

// The limiter lives in module memory; without this a burst in one test would
// spill into the next one and make failures depend on file order.
beforeEach(() => {
  resetRateLimits();
});
