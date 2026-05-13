import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import fallbackSaaSAppOpenApiSpec from "@/lib/swagger/openapi-platform-docs.json";

const generateSaaSAppOpenAPISpecMock = vi.fn();

vi.mock("@/lib/swagger/saas-app-openapi-generator", () => ({
  generateSaaSAppOpenAPISpec: generateSaaSAppOpenAPISpecMock,
}));

describe("/api/openapi", () => {
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    ({ GET } = await import("./route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    generateSaaSAppOpenAPISpecMock.mockReturnValue({
      openapi: "3.0.0",
      info: { title: "Runtime OpenAPI" },
      paths: { "/runtime": {} },
    });
  });

  it("returns the generated SaaS OpenAPI document", async () => {
    const request = new NextRequest("https://saas.example.com/api/openapi");

    const response = await GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      info: { title: "Runtime OpenAPI" },
      paths: { "/runtime": {} },
    });
  });

  it("falls back to the checked-in platform spec when generation fails", async () => {
    const error = new Error("boom");
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    generateSaaSAppOpenAPISpecMock.mockImplementation(() => {
      throw error;
    });

    const request = new NextRequest("https://saas.example.com/api/openapi");
    const response = await GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      info: fallbackSaaSAppOpenApiSpec.info,
      paths: {
        "/registry/api/v1/registry-entry-search":
          fallbackSaaSAppOpenApiSpec.paths[
            "/registry/api/v1/registry-entry-search"
          ],
      },
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to generate /api/openapi spec, serving checked-in snapshot:",
      error,
    );

    consoleErrorSpy.mockRestore();
  });
});
