import { beforeEach, describe, expect, it, vi } from "vitest";

describe("generateSaaSAppOpenAPISpec", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("works when shared query schemas load before the OpenAPI generator", async () => {
    await import("@/lib/schemas/api-query");

    const { generateSaaSAppOpenAPISpec } = await import("./saas-app-openapi");

    expect(() => generateSaaSAppOpenAPISpec()).not.toThrow();

    const spec = generateSaaSAppOpenAPISpec();

    expect(spec.paths["/agents"]).toBeDefined();
    expect(spec.paths["/credits"]).toBeDefined();
  });
});
