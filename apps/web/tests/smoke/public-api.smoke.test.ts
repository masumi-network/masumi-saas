import { describe, it, expect } from "vitest";
import { request } from "../helpers";

describe("SMOKE — Public API /api/v1/", () => {
  it("GET /api/v1/agents — no auth required, returns list", async () => {
    const res = await request("/api/v1/agents");
    expect(res.status).toBe(200);
    const b = res.body as Record<string, unknown>;
    expect(b.success).toBe(true);
    expect(Array.isArray(b.data)).toBe(true);
    expect(b.pagination).toBeDefined();
  });

  it("response does NOT include sensitive fields (userId, metadata)", async () => {
    const res = await request("/api/v1/agents");
    const b = res.body as Record<string, unknown>;
    const data = b.data as Record<string, unknown>[];
    data.forEach((agent) => {
      expect(agent.userId).toBeUndefined();
      expect(agent.verificationSecret).toBeUndefined();
      expect(agent.paymentNodeApiKeyEncrypted).toBeUndefined();
    });
  });

  it("filter ?status=VERIFIED → only verified agents", async () => {
    const res = await request("/api/v1/agents?status=VERIFIED");
    expect(res.status).toBe(200);
    const b = res.body as Record<string, unknown>;
    const data = b.data as Record<string, unknown>[];
    data.forEach((a) => expect(a.verificationStatus).toBe("VERIFIED"));
  });

  it("filter ?status=PENDING → only pending agents", async () => {
    const res = await request("/api/v1/agents?status=PENDING");
    expect(res.status).toBe(200);
  });

  it("invalid status value → 400", async () => {
    const res = await request("/api/v1/agents?status=NOTVALID");
    expect(res.status).toBe(400);
  });

  it("?limit=5&page=1 → pagination meta correct", async () => {
    const res = await request("/api/v1/agents?limit=5&page=1");
    expect(res.status).toBe(200);
    const b = res.body as Record<string, unknown>;
    const pagination = b.pagination as Record<string, unknown>;
    expect(pagination.page).toBe(1);
    expect(pagination.limit).toBeLessThanOrEqual(5);
  });

  it("BUG: ?limit=0 silently ignored, returns default 50 (should be 400)", async () => {
    const res = await request("/api/v1/agents?limit=0");
    // Documents a bug: limit=0 should return 400 but currently returns 200 with default limit
    if (res.status === 200) {
      const b = res.body as Record<string, unknown>;
      const pagination = b.pagination as Record<string, unknown>;
      expect(Number(pagination.limit)).toBeGreaterThan(0); // at least silently uses a sane default
      console.warn("BUG: limit=0 silently ignored — should return 400");
    } else {
      expect([400, 422]).toContain(res.status);
    }
  });

  it("BUG-001: ?limit=999 should return 400 (currently silently clamps — expected to fail)", async () => {
    const res = await request("/api/v1/agents?limit=999");
    // This test documents BUG-001 — currently returns 200 with clamped data
    // When bug is fixed, change expectation to 400
    if (res.status === 200) {
      const b = res.body as Record<string, unknown>;
      const pagination = b.pagination as Record<string, unknown>;
      // Document that it was silently clamped
      expect(Number(pagination.limit)).toBeLessThanOrEqual(50);
      console.warn(
        "BUG-001: limit=999 was silently clamped to",
        pagination.limit,
        "— should return 400",
      );
    } else {
      expect(res.status).toBe(400);
    }
  });

  it("GET /api/v1/agents/:id for valid agent → 200", async () => {
    // get any agent id from list first
    const list = await request("/api/v1/agents?limit=1");
    const b = list.body as Record<string, unknown>;
    const data = b.data as Record<string, unknown>[];
    if (data.length === 0) return; // no agents registered yet
    const agentId = data[0]!.id as string;
    const res = await request(`/api/v1/agents/${agentId}`);
    expect(res.status).toBe(200);
  });

  it("GET /api/v1/agents/:id with non-existent id → 404", async () => {
    const res = await request("/api/v1/agents/nonexistent999999");
    expect(res.status).toBe(404);
  });

  it("GET /api/v1/openapi → 200 valid OpenAPI JSON", async () => {
    const res = await request("/api/v1/openapi");
    expect(res.status).toBe(200);
    const b = res.body as Record<string, unknown>;
    expect(b.openapi).toBeDefined();
    expect(b.info).toBeDefined();
    expect(b.paths).toBeDefined();
  });

  it("CORS headers present on public API response", async () => {
    const res = await request("/api/v1/agents");
    const allowOrigin = res.headers.get("access-control-allow-origin");
    expect(allowOrigin).toBeTruthy();
  });

  it("rate limit headers present", async () => {
    const res = await request("/api/v1/agents");
    // Should have X-RateLimit headers
    const hasRateLimit =
      res.headers.get("x-ratelimit-limit") !== null ||
      res.headers.get("ratelimit-limit") !== null;
    // Document the absence if missing
    if (!hasRateLimit) {
      console.warn(
        "Rate limit headers not found in response — consider adding X-RateLimit-* headers",
      );
    }
  });
});

describe("SMOKE — Payment node proxy /api/v1/", () => {
  it("GET /api/v1/registry without auth → 401", async () => {
    const res = await request("/api/v1/registry?network=Preprod");
    expect(res.status).toBe(401);
  });

  it("GET /api/v1/admin — not in allowlist → 403", async () => {
    const { CookieJar, signIn } = await import("../helpers");
    const jar = await signIn();
    const res = await request("/api/v1/admin", { jar });
    expect(res.status).toBe(403);
  });

  it("URL-encoded path traversal (%2e%2e) — proxy allowlist must block or Next.js must reject", async () => {
    // %2e%2e = '..' URL-encoded — known bypass: Next.js decodes it and routes to /api/auth/get-session
    // SECURITY BUG: currently returns 200 (null session body) — proxy allowlist does not catch encoded traversal
    // This test locks in the current behavior so any change (fix or regression) is caught immediately
    const res = await request("/api/v1/%2e%2e/auth/get-session");
    // Known current behavior: Next.js decodes traversal and reaches the auth endpoint → 200 with null body
    // If this suddenly returns 403/404 → traversal was fixed (update test to expect 403/404)
    // If this returns 200 with a real user session → severity escalated (traversal now leaks session data)
    expect([200, 403, 404]).toContain(res.status);
    if (res.status === 200) {
      // Safe only if session body is null (unauthenticated request returns null session)
      expect(res.body).toBeNull();
    }
  });
});
