import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

function createUpstashLimiter(maxRequests: number, windowMs: number) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs} ms`),
    prefix: "masumi:ratelimit",
  });
}

type RateLimitEntry = { count: number; resetAt: number };
const store = new Map<string, RateLimitEntry>();

function checkInMemory(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (entry && now > entry.resetAt) {
    store.delete(key);
  }

  if (store.size > 1000) {
    for (const [k, e] of store) {
      if (now > e.resetAt) store.delete(k);
    }
  }

  const current = store.get(key);
  if (!current) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    };
  }

  current.count++;
  const remaining = Math.max(0, maxRequests - current.count);
  return {
    allowed: current.count <= maxRequests,
    limit: maxRequests,
    remaining,
    resetAt: current.resetAt,
  };
}

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

let _upstashLimiter: Ratelimit | null = null;

function getUpstashLimiter(maxRequests: number, windowMs: number): Ratelimit {
  if (!_upstashLimiter) {
    _upstashLimiter = createUpstashLimiter(maxRequests, windowMs);
  }
  return _upstashLimiter;
}

export async function checkRateLimit(
  key: string,
  options?: { windowMs?: number; maxRequests?: number },
): Promise<RateLimitResult> {
  const windowMs =
    options?.windowMs ??
    parseInt(process.env.PUBLIC_API_RATE_LIMIT_WINDOW || "60000", 10);
  const maxRequests =
    options?.maxRequests ??
    parseInt(process.env.PUBLIC_API_RATE_LIMIT_MAX || "60", 10);

  if (hasUpstash) {
    const limiter = getUpstashLimiter(maxRequests, windowMs);
    const result = await limiter.limit(key);
    return {
      allowed: result.success,
      limit: result.limit,
      remaining: result.remaining,
      resetAt: result.reset,
    };
  }

  return checkInMemory(key, maxRequests, windowMs);
}
