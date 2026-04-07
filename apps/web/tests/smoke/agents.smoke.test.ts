import { beforeAll, describe, expect, it } from "vitest";

import { CookieJar, createAgent, request, signIn } from "../helpers";

let jar: CookieJar;

beforeAll(async () => {
  jar = await signIn();
});

describe("SMOKE — Agent access control", () => {
  it("GET /api/agents without auth → 401", async () => {
    const res = await request("/api/agents?network=Preprod");
    expect(res.status).toBe(401);
  });

  it("POST /api/agents without auth → 401", async () => {
    const res = await request("/api/agents?network=Preprod", {
      method: "POST",
      body: { name: "x", apiUrl: "https://x.com", tags: "t" },
    });
    expect(res.status).toBe(401);
  });

  it("GET /api/agents/:id without auth → 401", async () => {
    const res = await request("/api/agents/someid");
    expect(res.status).toBe(401);
  });

  it("GET /api/agents/:id with non-existent id → 404", async () => {
    const res = await request("/api/agents/doesnotexist999", { jar });
    expect(res.status).toBe(404);
  });
});

describe("SMOKE — Agent input validation", () => {
  it("missing name → 400", async () => {
    const res = await request("/api/agents?network=Preprod", {
      method: "POST",
      jar,
      body: { apiUrl: "https://example.com", tags: "t" },
    });
    expect(res.status).toBe(400);
    const b = res.body as Record<string, unknown>;
    expect(b.success).toBe(false);
    expect(b.error).toBeTruthy();
  });

  it("invalid apiUrl (not a URL) → 400", async () => {
    const res = await request("/api/agents?network=Preprod", {
      method: "POST",
      jar,
      body: { name: "Test", apiUrl: "not-a-url", tags: "t" },
    });
    expect(res.status).toBe(400);
  });

  it("apiUrl without http/https scheme → 400", async () => {
    const res = await request("/api/agents?network=Preprod", {
      method: "POST",
      jar,
      body: { name: "Test", apiUrl: "ftp://example.com", tags: "t" },
    });
    expect(res.status).toBe(400);
  });

  it("empty tags string → 400", async () => {
    const res = await request("/api/agents?network=Preprod", {
      method: "POST",
      jar,
      body: { name: "Test", apiUrl: "https://example.com", tags: "" },
    });
    expect(res.status).toBe(400);
    const b = res.body as Record<string, unknown>;
    expect(String(b.error)).toContain("tag");
  });

  it("name over 250 chars → 400", async () => {
    const res = await request("/api/agents?network=Preprod", {
      method: "POST",
      jar,
      body: { name: "a".repeat(251), apiUrl: "https://example.com", tags: "t" },
    });
    expect(res.status).toBe(400);
  });

  it("description over 250 chars → 400", async () => {
    const res = await request("/api/agents?network=Preprod", {
      method: "POST",
      jar,
      body: {
        name: "Test",
        description: "d".repeat(251),
        apiUrl: "https://example.com",
        tags: "t",
      },
    });
    expect(res.status).toBe(400);
  });

  it("extendedDescription over 5000 chars → 400", async () => {
    const res = await request("/api/agents?network=Preprod", {
      method: "POST",
      jar,
      body: {
        name: "Test",
        extendedDescription: "x".repeat(5001),
        apiUrl: "https://example.com",
        tags: "t",
      },
    });
    expect(res.status).toBe(400);
  });

  it("Mainnet registration is blocked → 400", async () => {
    const res = await request("/api/agents?network=Mainnet", {
      method: "POST",
      jar,
      body: { name: "Test", apiUrl: "https://example.com", tags: "t" },
    });
    expect(res.status).toBe(400);
  });

  it("invalid pricing type → 400", async () => {
    const res = await request("/api/agents?network=Preprod", {
      method: "POST",
      jar,
      body: {
        name: "Test",
        apiUrl: "https://example.com",
        tags: "t",
        pricing: { pricingType: "INVALID" },
      },
    });
    expect(res.status).toBe(400);
  });
});

describe("SMOKE — Agent CRUD", () => {
  it("GET /api/agents returns list with pagination fields", async () => {
    const res = await request("/api/agents?network=Preprod", { jar });
    expect(res.status).toBe(200);
    const b = res.body as Record<string, unknown>;
    expect(b.success).toBe(true);
    expect(Array.isArray(b.data)).toBe(true);
    expect("nextCursor" in b).toBe(true);
  });

  it("GET /api/agents/counts → 200 with count fields", async () => {
    const res = await request("/api/agents/counts?network=Preprod", { jar });
    expect(res.status).toBe(200);
    const b = res.body as Record<string, unknown>;
    expect(b.success).toBe(true);
  });

  it("GET agent by id returns full agent shape", async () => {
    const agentId = await createAgent(jar);
    const res = await request(`/api/agents/${agentId}`, { jar });
    expect(res.status).toBe(200);
    const b = res.body as Record<string, unknown>;
    expect(b.success).toBe(true);
    const data = b.data as Record<string, unknown>;
    expect(data.id).toBe(agentId);
    expect(data.name).toBeDefined();
    expect(data.registrationState).toBeDefined();
    expect(data.verificationStatus).toBeDefined();
    // sensitive field: verificationSecret should be undefined or null — never a real value
    // Currently returned as null (included in response) — ideally should be omitted entirely
    expect(data.verificationSecret ?? null).toBeNull();
  });

  it("DELETE confirmed agent without deregistering → 400", async () => {
    // find or create a confirmed agent
    const listRes = await request(
      "/api/agents?network=Preprod&registrationState=RegistrationConfirmed",
      { jar },
    );
    const agents = (listRes.body as Record<string, unknown>).data as unknown[];
    if (agents.length === 0) {
      console.warn("No confirmed agent available — skipping delete guard test");
      return;
    }
    const agentId = (agents[0] as Record<string, unknown>).id as string;
    const res = await request(`/api/agents/${agentId}`, {
      method: "DELETE",
      jar,
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/agents/:id/earnings → 200", async () => {
    const listRes = await request("/api/agents?network=Preprod&take=1", {
      jar,
    });
    const agents = (listRes.body as Record<string, unknown>).data as Record<
      string,
      unknown
    >[];
    if (agents.length === 0) {
      console.warn("No agents for earnings test — skipping");
      return;
    }
    const agentId = agents[0]!.id as string;
    const res = await request(`/api/agents/${agentId}/earnings`, { jar });
    expect(res.status).toBe(200);
  });

  it("GET /api/agents/:id/transactions → 200", async () => {
    const listRes = await request("/api/agents?network=Preprod&take=1", {
      jar,
    });
    const agents = (listRes.body as Record<string, unknown>).data as Record<
      string,
      unknown
    >[];
    if (agents.length === 0) {
      console.warn("No agents for transactions test — skipping");
      return;
    }
    const agentId = agents[0]!.id as string;
    const res = await request(`/api/agents/${agentId}/transactions`, { jar });
    expect(res.status).toBe(200);
  });
});

describe("SMOKE — Agent search & filter", () => {
  it("search by name substring", async () => {
    const res = await request("/api/agents?network=Preprod&search=Test", {
      jar,
    });
    expect(res.status).toBe(200);
  });

  it("filter by registrationState=RegistrationRequested", async () => {
    const res = await request(
      "/api/agents?network=Preprod&registrationState=RegistrationRequested",
      { jar },
    );
    expect(res.status).toBe(200);
    const b = res.body as Record<string, unknown>;
    const data = b.data as Record<string, unknown>[];
    data.forEach((a) =>
      expect(a.registrationState).toBe("RegistrationRequested"),
    );
  });

  it("cursor pagination returns next cursor", async () => {
    const first = await request("/api/agents?network=Preprod&take=1", { jar });
    expect(first.status).toBe(200);
    const b = first.body as Record<string, unknown>;
    if (b.nextCursor) {
      const second = await request(
        `/api/agents?network=Preprod&take=1&cursor=${b.nextCursor}`,
        { jar },
      );
      expect(second.status).toBe(200);
    }
  });
});
