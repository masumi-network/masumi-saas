import { describe, it, expect, beforeAll } from "vitest";
import { request, signIn, CookieJar } from "../helpers";

let jar: CookieJar;

beforeAll(async () => {
  jar = await signIn();
});

describe("SMOKE — Dashboard & Activity", () => {
  it("GET /api/dashboard/overview → 200 with expected shape", async () => {
    const res = await request("/api/dashboard/overview?network=Preprod", {
      jar,
    });
    expect(res.status).toBe(200);
    const b = res.body as Record<string, unknown>;
    expect(b.success).toBe(true);
    expect(b.data).toBeDefined();
  });

  it("GET /api/dashboard/overview without auth → 401", async () => {
    const res = await request("/api/dashboard/overview?network=Preprod");
    expect(res.status).toBe(401);
  });

  it("GET /api/activity → 200 with items array nested in data", async () => {
    const res = await request("/api/activity?network=Preprod", { jar });
    expect(res.status).toBe(200);
    const b = res.body as Record<string, unknown>;
    expect(b.success).toBe(true);
    const data = b.data as Record<string, unknown>;
    expect(Array.isArray(data.items)).toBe(true);
  });

  it("GET /api/earnings → 200", async () => {
    const res = await request("/api/earnings", { jar });
    expect(res.status).toBe(200);
    const b = res.body as Record<string, unknown>;
    expect(b.success).toBe(true);
  });

  it("GET /api/credentials/schema-said → 200 with nested schemaSaid string", async () => {
    const res = await request("/api/credentials/schema-said", { jar });
    expect(res.status).toBe(200);
    const b = res.body as Record<string, unknown>;
    expect(b.success).toBe(true);
    const data = b.data as Record<string, unknown>;
    expect(typeof data.schemaSaid).toBe("string");
    expect((data.schemaSaid as string).length).toBeGreaterThan(0);
  });

  it("GET /api/credentials/status without id → 400", async () => {
    const res = await request("/api/credentials/status", { jar });
    expect(res.status).toBe(400);
  });

  it("GET /api/credentials/status with empty id → 400", async () => {
    const res = await request("/api/credentials/status?id=", { jar });
    expect(res.status).toBe(400);
  });
});
