/**
 * STRESS — Database transaction & lock tests
 *
 * Targets race conditions identified in code review:
 * - TOCTOU on deleteAgentAction (no FOR UPDATE)
 * - Concurrent deregister + delete
 * - Cursor pagination consistency under mutation
 * - 10-parallel dashboard queries (no connection pool exhaustion)
 */

import { beforeAll, describe, expect, it } from "vitest";

import {
  CookieJar,
  request,
  signIn,
  TEST_EMAIL,
  TEST_PASSWORD,
  TEST_PREPROD_COLLECTION_ADDRESS,
} from "../helpers";

let jar: CookieJar;

beforeAll(async () => {
  jar = await signIn();
});

describe("STRESS — Delete race conditions (TOCTOU test)", () => {
  it("simultaneous DELETE on same agent — exactly one succeeds or both gracefully fail", async () => {
    // Use a RegistrationFailed agent so we can actually delete it
    const listRes = await request(
      "/api/agents?network=Preprod&registrationState=RegistrationFailed",
      { jar },
    );
    const agents = (listRes.body as Record<string, unknown>).data as Record<
      string,
      unknown
    >[];

    if (agents.length === 0) {
      console.warn("No RegistrationFailed agent for TOCTOU test — skipping");
      return;
    }

    const agentId = agents[0]!.id as string;

    // Fire two simultaneous DELETE requests
    const [r1, r2] = await Promise.all([
      request(`/api/agents/${agentId}`, { method: "DELETE", jar }),
      request(`/api/agents/${agentId}`, { method: "DELETE", jar }),
    ]);

    console.log(`DELETE race: r1=${r1.status} r2=${r2.status}`);

    const statuses = [r1.status, r2.status].sort();
    // Acceptable outcomes:
    // 200 + 404 (one wins, other gets not-found — correct)
    // 200 + 400 (one wins, other gets guard error — acceptable)
    // 400 + 400 (both blocked — acceptable)
    // NOT acceptable: 200 + 200 (double delete) or 500 + anything (crash)
    expect(statuses).not.toContain(500);

    const successCount = [r1.status, r2.status].filter((s) => s === 200).length;
    expect(successCount).toBeLessThanOrEqual(1); // at most one delete should succeed
  });

  it("simultaneous deregister + read on same agent — no 500", async () => {
    const listRes = await request(
      "/api/agents?network=Preprod&registrationState=RegistrationConfirmed",
      { jar },
    );
    const agents = (listRes.body as Record<string, unknown>).data as Record<
      string,
      unknown
    >[];

    if (agents.length === 0) {
      console.warn("No confirmed agent for deregister race test — skipping");
      return;
    }

    const agentId = agents[0]!.id as string;

    // Fire deregister + read simultaneously
    const [deregisterRes, readRes] = await Promise.all([
      request(`/api/agents/${agentId}/deregister`, { method: "POST", jar }),
      request(`/api/agents/${agentId}`, { jar }),
    ]);

    console.log(
      `Deregister race: deregister=${deregisterRes.status} read=${readRes.status}`,
    );

    // Neither should crash the server
    expect(deregisterRes.status).not.toBe(500);
    expect(readRes.status).not.toBe(500);
    // Read must always succeed
    expect(readRes.status).toBe(200);
  });
});

describe("STRESS — Pagination consistency under mutation", () => {
  it("cursor pagination remains consistent while new agents are added", async () => {
    // Start paginating
    const page1Res = await request("/api/agents?network=Preprod&take=2", {
      jar,
    });
    const page1 = page1Res.body as Record<string, unknown>;
    const cursor = page1.nextCursor as string | null;

    if (!cursor) {
      console.warn("Not enough agents for pagination test — skipping");
      return;
    }

    // Add a new agent while we paginate
    const addRes = await request("/api/agents?network=Preprod", {
      method: "POST",
      jar,
      body: {
        name: `Pagination-Race-${Date.now()}`,
        apiUrl: "https://example.com/paginate",
        collectionAddress: TEST_PREPROD_COLLECTION_ADDRESS,
        tags: "pagination,stress",
      },
    });
    expect([200, 201]).toContain(addRes.status);
    expect((addRes.body as Record<string, unknown>).agentId).toBeDefined();

    // Now fetch page 2
    const page2Res = await request(
      `/api/agents?network=Preprod&take=2&cursor=${cursor}`,
      { jar },
    );

    expect(page2Res.status).toBe(200);
    const page2 = page2Res.body as Record<string, unknown>;
    const page1Ids = new Set(
      (page1.data as Record<string, unknown>[]).map((a) => a.id),
    );
    const page2Data = page2.data as Record<string, unknown>[];

    // Page 2 items must not overlap with page 1
    page2Data.forEach((a) => {
      expect(page1Ids.has(a.id)).toBe(false);
    });
  });

  it("take=50 (max) returns at most 50 items", async () => {
    const res = await request("/api/agents?network=Preprod&take=50", { jar });
    expect(res.status).toBe(200);
    const b = res.body as Record<string, unknown>;
    const data = b.data as unknown[];
    expect(data.length).toBeLessThanOrEqual(50);
  });

  it("take=51 (over max) → 400", async () => {
    const res = await request("/api/agents?network=Preprod&take=51", { jar });
    expect(res.status).toBe(400);
  });
});

describe("STRESS — DB connection pool (10 parallel heavy queries)", () => {
  it("10 simultaneous dashboard + agents + activity queries — no connection exhaustion", async () => {
    const tasks = Array.from({ length: 10 }, (_, i) => {
      if (i % 3 === 0)
        return request("/api/dashboard/overview?network=Preprod", { jar });
      if (i % 3 === 1) return request("/api/agents?network=Preprod", { jar });
      return request("/api/activity?network=Preprod", { jar });
    });

    const results = await Promise.all(tasks);

    const errors = results.filter((r) => r.status === 500);
    if (errors.length > 0) {
      console.error(
        "DB pool exhaustion? Got 500s:",
        errors.map((e) => e.body),
      );
    }
    expect(errors.length).toBe(0);
    results.forEach((r) => expect(r.status).toBe(200));
  });
});

describe("STRESS — Auth under load", () => {
  it("10 simultaneous sign-in requests — all succeed", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        request("/api/auth/sign-in/email", {
          method: "POST",
          body: {
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
          },
        }),
      ),
    );
    results.forEach((r) => {
      expect(r.status).toBe(200);
    });
  });

  it("50 simultaneous unauthenticated GET /api/agents — all return 401 (no leak)", async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, () => request("/api/agents")),
    );
    results.forEach((r) => expect(r.status).toBe(401));
  });
});
