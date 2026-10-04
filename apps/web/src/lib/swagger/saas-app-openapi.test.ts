import { beforeEach, describe, expect, it, vi } from "vitest";

describe("generateSaaSAppOpenAPISpec", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it.each([
    "/api/x402/probe",
    "/api/agents/batch-x402",
    "/api/agents/x402-registered-check",
  ])("documents the POST operation at %s", async (path) => {
    const { generateSaaSAppOpenAPISpec } =
      await import("./saas-app-openapi-generator");

    const spec = generateSaaSAppOpenAPISpec();
    expect(spec.paths?.[path]?.post).toBeDefined();
  });

  it("works when shared query schemas load before the OpenAPI generator", async () => {
    await import("@/lib/schemas/api-query");

    const { generateSaaSAppOpenAPISpec } =
      await import("./saas-app-openapi-generator");

    expect(() => generateSaaSAppOpenAPISpec()).not.toThrow();

    const spec = generateSaaSAppOpenAPISpec();

    expect(spec.paths?.["/api/agents"]).toBeDefined();
    expect(spec.paths?.["/agents"]).toBeUndefined();
    expect(spec.paths?.["/api/credits"]).toBeDefined();
    expect(spec.paths?.["/credits"]).toBeDefined();
    expect(spec.paths?.["/api/credentials/schema-said"]).toBeDefined();
    expect(spec.paths?.["/api/activity/transaction"]).toBeDefined();
    expect(spec.paths?.["/api/earnings/agent"]).toBeDefined();
    expect(spec.paths?.["/api/earnings/agents"]).toBeDefined();
    expect(spec.paths?.["/api/masumi/inbox-agent/register"]).toBeDefined();
  });
});
