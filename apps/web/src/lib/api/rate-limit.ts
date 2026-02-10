type RateLimitEntry = { count: number; resetAt: number };

const store = new Map<string, RateLimitEntry>();

// Periodically clean up expired entries to prevent memory leaks
const CLEANUP_INTERVAL_MS = 60_000; // 1 minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

export function checkRateLimit(
  key: string,
  options?: { windowMs?: number; maxRequests?: number },
): RateLimitResult {
  const windowMs =
    options?.windowMs ??
    parseInt(process.env.PUBLIC_API_RATE_LIMIT_WINDOW || "60000", 10);
  const maxRequests =
    options?.maxRequests ??
    parseInt(process.env.PUBLIC_API_RATE_LIMIT_MAX || "60", 10);

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    };
  }

  entry.count++;
  const remaining = Math.max(0, maxRequests - entry.count);
  return {
    allowed: entry.count <= maxRequests,
    limit: maxRequests,
    remaining,
    resetAt: entry.resetAt,
  };
}
