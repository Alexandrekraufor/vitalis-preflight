/**
 * Fixed-window rate limiter held in process memory.
 *
 * Deliberately not Redis. The point here is to blunt credential guessing and
 * accidental floods against a single-instance deployment, and a shared store
 * would be infrastructure this project does not otherwise need. The limitation
 * is real and documented: with several instances behind a load balancer each
 * one counts separately, so the effective limit multiplies by the instance
 * count. `docs/security.md` says so out loud.
 */
export interface RateLimitRule {
  readonly limit: number;
  readonly windowMs: number;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Keeps the map from growing without bound on a long-running process. */
function evictExpired(now: number): void {
  if (windows.size < 1000) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export function consumeRateLimit(
  key: string,
  rule: RateLimitRule,
  now: number = Date.now(),
): RateLimitDecision {
  evictExpired(now);

  const current = windows.get(key);

  if (current === undefined || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
  }

  current.count += 1;

  const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));

  return current.count > rule.limit
    ? { allowed: false, remaining: 0, retryAfterSeconds }
    : { allowed: true, remaining: rule.limit - current.count, retryAfterSeconds: 0 };
}

/** Test seam: drops every window so cases do not leak into each other. */
export function resetRateLimits(): void {
  windows.clear();
}

/**
 * Best-effort client identity for rate limiting.
 *
 * Proxy headers are attacker-controlled, so this is a throttling key and never
 * an authorization input.
 */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  return `${scope}:${forwarded ?? real ?? "unknown"}`;
}
