import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const captureExceptionMock = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
}));

type EnvSnapshot = Record<string, string | undefined>;

function setEnvValue(key: string, value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) {
    delete env[key];
    return;
  }

  env[key] = value;
}

function captureEnv(): EnvSnapshot {
  return {
    NODE_ENV: process.env.NODE_ENV,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  };
}

function restoreEnv(snapshot: EnvSnapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    setEnvValue(key, value);
  }
}

describe("rate limit backend hardening", () => {
  const envSnapshot = captureEnv();

  afterEach(() => {
    restoreEnv(envSnapshot);
    captureExceptionMock.mockReset();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("fails closed once in production when Upstash is missing", async () => {
    setEnvValue("NODE_ENV", "production");
    setEnvValue("UPSTASH_REDIS_REST_URL", undefined);
    setEnvValue("UPSTASH_REDIS_REST_TOKEN", undefined);

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { checkRateLimit } = await import("./rate-limit");

    const first = await checkRateLimit("public:test-1");
    const second = await checkRateLimit("public:test-2");

    expect(first).toMatchObject({
      allowed: false,
      reason: "backend_unavailable",
    });
    expect(second).toMatchObject({
      allowed: false,
      reason: "backend_unavailable",
    });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
  });

  it("returns a 503 helper response when the backend is unavailable", async () => {
    setEnvValue("NODE_ENV", "production");
    setEnvValue("UPSTASH_REDIS_REST_URL", undefined);
    setEnvValue("UPSTASH_REDIS_REST_TOKEN", undefined);

    const { checkRateLimitOrRespond } =
      await import("./rate-limit-with-response");

    const request = new NextRequest("https://saas.example.com/api/v1/agents", {
      headers: {
        Origin: "https://client.example.com",
        "x-forwarded-for": "203.0.113.10",
      },
    });

    const result = await checkRateLimitOrRespond(request, "public");

    expect("response" in result).toBe(true);
    if (!("response" in result)) {
      return;
    }

    expect(result.response.status).toBe(503);
    await expect(result.response.json()).resolves.toMatchObject({
      success: false,
      error: "rate_limit_backend_unavailable",
    });
  });
});
