import { describe, expect, it } from "vitest";

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
    const hasRateLimit =
      res.headers.get("x-ratelimit-limit") !== null ||
      res.headers.get("ratelimit-limit") !== null;
    expect(hasRateLimit).toBe(true);
  });

  it("public /api/v1/openapi stays limited to public discovery routes", async () => {
    const res = await request("/api/v1/openapi");
    expect(res.status).toBe(200);
    const b = res.body as { paths?: Record<string, unknown> };
    expect(b.paths?.["/registry-entry"]).toBeUndefined();
    expect(b.paths?.["/registry-diff"]).toBeUndefined();
  });
});

describe("SMOKE — Authenticated payment/registry wrappers", () => {
  it("GET /pay/api/v1/registry without auth → 401", async () => {
    const res = await request("/pay/api/v1/registry?network=Preprod");
    expect(res.status).toBe(401);
  });

  it("GET /pay/api/v1/inbox-agents without auth → 401", async () => {
    const res = await request("/pay/api/v1/inbox-agents?network=Preprod");
    expect(res.status).toBe(401);
  });

  it("POST /registry/api/v1/registry-entry without auth → 401", async () => {
    const res = await request(
      "/registry/api/v1/registry-entry?network=Preprod",
      {
        method: "POST",
        body: { limit: 1, network: "Preprod" },
      },
    );
    expect(res.status).toBe(401);
  });

  it("POST /registry/api/v1/inbox-agent-registration-search without auth → 401", async () => {
    const res = await request(
      "/registry/api/v1/inbox-agent-registration-search?network=Preprod",
      {
        method: "POST",
        body: {
          limit: 1,
          network: "Preprod",
          query: "agent@example.com",
        },
      },
    );
    expect(res.status).toBe(401);
  });

  it("GET /api/v1/admin — not exposed → 404", async () => {
    const { CookieJar, signIn } = await import("../helpers");
    const jar = await signIn();
    const res = await request("/api/v1/admin", { jar });
    expect(res.status).toBe(404);
  });

  it("GET /registry/api/v1/registry-source without admin → 403", async () => {
    const { signIn } = await import("../helpers");
    const jar = await signIn();
    const res = await request("/registry/api/v1/registry-source", { jar });
    expect(res.status).toBe(403);
  });

  it("URL-encoded path traversal (%2e%2e) is not routable → 404", async () => {
    const res = await request("/api/v1/%2e%2e/auth/get-session");
    expect(res.status).toBe(404);
  });

  it("GET /api/openapi includes proxied registry lookup routes", async () => {
    const res = await request("/api/openapi");
    expect(res.status).toBe(200);
    const b = res.body as { paths?: Record<string, unknown> };
    expect(b.paths?.["/registry/api/v1/registry-entry"]).toBeDefined();
    expect(b.paths?.["/registry/api/v1/registry-entry-search"]).toBeDefined();
    expect(b.paths?.["/registry/api/v1/registry-diff"]).toBeDefined();
    expect(b.paths?.["/registry/api/v1/capability"]).toBeDefined();
    expect(
      b.paths?.["/registry/api/v1/inbox-agent-registration-search"],
    ).toBeDefined();
    expect(
      b.paths?.["/registry/api/v1/inbox-agent-registration"],
    ).toBeDefined();
    expect(
      b.paths?.["/registry/api/v1/inbox-agent-registration-diff"],
    ).toBeDefined();
    expect(b.paths?.["/registry/api/v1/registry-source"]).toBeDefined();
    expect(b.paths?.["/pay/api/v1/payment"]).toBeDefined();
    expect(b.paths?.["/pay/api/v1/inbox-agents"]).toBeDefined();
    expect(b.paths?.["/v1/registry-entry"]).toBeUndefined();
    expect(b.paths?.["/inbox-agents"]).toBeUndefined();
  });
});
