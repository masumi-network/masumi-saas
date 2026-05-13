import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const prismaUserFindUniqueMock = vi.fn();
const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const isAdminUserMock = vi.fn();
const resolveRegistrySharedTokenUpstreamMock = vi.fn();

vi.mock("@masumi/database/client", () => ({
  default: {
    user: {
      findUnique: prismaUserFindUniqueMock,
    },
  },
}));

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: handleAuthErrorMock,
  isAdminUser: isAdminUserMock,
}));

vi.mock("@/lib/v1-proxy/explicit-route-support", () => {
  return {
    buildUpstreamHeaders: (request: NextRequest, token: string) => {
      const headers = new Headers();
      headers.set("token", token);
      headers.set(
        "Content-Type",
        request.headers.get("content-type") ?? "application/json",
      );
      return headers;
    },
    readOptionalRequestBody: async (request: NextRequest) => {
      const body = await request.text();
      return body || undefined;
    },
    resolveRegistrySharedTokenUpstream: resolveRegistrySharedTokenUpstreamMock,
    toUpstreamResponse: async (response: Response) => {
      const text = await response.text();
      return Response.json(JSON.parse(text), { status: response.status });
    },
  };
});

describe("/registry/api/v1/registry-source", () => {
  let GET: typeof import("./route").GET;
  let PATCH: typeof import("./route").PATCH;

  beforeAll(async () => {
    ({ GET, PATCH } = await import("./route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    handleAuthErrorMock.mockReturnValue(null);
    getAuthenticatedOrThrowMock.mockResolvedValue({
      user: { id: "admin-1" },
      authMethod: "session",
    });
    prismaUserFindUniqueMock.mockResolvedValue({ role: "ADMIN" });
    isAdminUserMock.mockReturnValue(true);
    resolveRegistrySharedTokenUpstreamMock.mockReturnValue({
      ok: true,
      baseUrl: "https://registry.example.com/api/v1",
      token: "registry-shared-token",
    });
  });

  it("forwards GET requests for admin users", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "success", data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest(
      "https://saas.example.com/registry/api/v1/registry-source?network=Preprod",
      { method: "GET" },
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(prismaUserFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "admin-1" },
      select: { role: true },
    });
    expect(isAdminUserMock).toHaveBeenCalledWith({
      id: "admin-1",
      role: "ADMIN",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://registry.example.com/api/v1/registry-source/?network=Preprod",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("forwards write requests with the request body for admin users", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest(
      "https://saas.example.com/registry/api/v1/registry-source?network=Preprod",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "source-1" }),
      },
    );

    const response = await PATCH(request);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://registry.example.com/api/v1/registry-source/?network=Preprod",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ name: "source-1" }),
      }),
    );
  });

  it("returns 403 for non-admin users", async () => {
    prismaUserFindUniqueMock.mockResolvedValue({ role: "USER" });
    isAdminUserMock.mockReturnValue(false);

    const request = new NextRequest(
      "https://saas.example.com/registry/api/v1/registry-source?network=Preprod",
      { method: "GET" },
    );

    const response = await GET(request);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Forbidden",
    });
  });

  it("returns 503 when the registry service is not configured", async () => {
    resolveRegistrySharedTokenUpstreamMock.mockReturnValue({
      ok: false,
      status: 503,
      error: "Registry service is not configured",
    });

    const request = new NextRequest(
      "https://saas.example.com/registry/api/v1/registry-source?network=Preprod",
      { method: "GET" },
    );

    const response = await GET(request);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Registry service is not configured",
    });
  });
});
