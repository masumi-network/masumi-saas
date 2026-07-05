import * as Sentry from "@sentry/nextjs";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { serverLog } from "@/lib/server/logger";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  reason?: "backend_unavailable";
};

let _upstashRedis: Redis | null = null;

function getUpstashRedis(): Redis {
  if (!_upstashRedis) {
    _upstashRedis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _upstashRedis;
}

function createUpstashLimiter(maxRequests: number, windowMs: number) {
  return new Ratelimit({
    redis: getUpstashRedis(),
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs} ms`),
    // Distinct prefix per policy so counters and Lua keys never mix across limits.
    prefix: `masumi:ratelimit:${maxRequests}:${windowMs}`,
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
const allowInMemoryFallback = process.env.NODE_ENV !== "production";
let hasLoggedMissingRateLimitBackend = false;

const _upstashLimiterByPolicy = new Map<string, Ratelimit>();

function upstashLimiterCacheKey(maxRequests: number, windowMs: number) {
  return `${windowMs}:${maxRequests}`;
}

function getUpstashLimiter(maxRequests: number, windowMs: number): Ratelimit {
  const cacheKey = upstashLimiterCacheKey(maxRequests, windowMs);
  let limiter = _upstashLimiterByPolicy.get(cacheKey);
  if (!limiter) {
    limiter = createUpstashLimiter(maxRequests, windowMs);
    _upstashLimiterByPolicy.set(cacheKey, limiter);
  }
  return limiter;
}

function reportMissingRateLimitBackend() {
  if (hasLoggedMissingRateLimitBackend) {
    return;
  }

  hasLoggedMissingRateLimitBackend = true;
  const error = new Error(
    "Upstash rate limit backend is not configured in production.",
  );

  serverLog.error("[rate-limit] backend unavailable", {
    code: "rate_limit_backend_unavailable",
    nodeEnv: process.env.NODE_ENV,
  });
  Sentry.captureException(error, {
    level: "error",
    tags: {
      component: "rate-limit",
      code: "rate_limit_backend_unavailable",
    },
  });
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

  if (!allowInMemoryFallback) {
    reportMissingRateLimitBackend();
    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      resetAt: Date.now() + windowMs,
      reason: "backend_unavailable",
    };
  }

  return checkInMemory(key, maxRequests, windowMs);
}

const CREDIT_TOP_UP_MAX_SESSIONS = 5;
const CREDIT_TOP_UP_WINDOW_MS = 15 * 60 * 1000;

/**
 * Limits how often a user can start Stripe Checkout for credit top-up.
 * Uses Upstash when configured. In production, matches {@link checkRateLimit}:
 * if Upstash is missing, fails closed (same as other rate limits). In
 * non-production, falls back to in-memory per instance.
 */
export async function checkCreditTopUpSessionLimit(
  userId: string,
): Promise<RateLimitResult> {
  const key = `credit-topup-session:${userId}`;
  if (hasUpstash) {
    const limiter = getUpstashLimiter(
      CREDIT_TOP_UP_MAX_SESSIONS,
      CREDIT_TOP_UP_WINDOW_MS,
    );
    const result = await limiter.limit(key);
    return {
      allowed: result.success,
      limit: result.limit,
      remaining: result.remaining,
      resetAt: result.reset,
    };
  }

  if (!allowInMemoryFallback) {
    reportMissingRateLimitBackend();
    return {
      allowed: false,
      limit: CREDIT_TOP_UP_MAX_SESSIONS,
      remaining: 0,
      resetAt: Date.now() + CREDIT_TOP_UP_WINDOW_MS,
      reason: "backend_unavailable",
    };
  }

  return checkInMemory(
    key,
    CREDIT_TOP_UP_MAX_SESSIONS,
    CREDIT_TOP_UP_WINDOW_MS,
  );
}
