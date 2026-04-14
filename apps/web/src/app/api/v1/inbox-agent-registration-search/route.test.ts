import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const rejectOidcAccessTokenAuthMock = vi.fn();
const resolveRegistrySharedTokenUpstreamMock = vi.fn();

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: handleAuthErrorMock,
}));

vi.mock("@/lib/auth/oidc-api-permissions", () => ({
  rejectOidcAccessTokenAuth: rejectOidcAccessTokenAuthMock,
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

describe("/api/v1/inbox-agent-registration-search", () => {
  let POST: typeof import("./route").POST;

  beforeAll(async () => {
    ({ POST } = await import("./route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    handleAuthErrorMock.mockReturnValue(null);
    getAuthenticatedOrThrowMock.mockResolvedValue({
      user: { id: "user-1" },
      authMethod: "session",
    });
    rejectOidcAccessTokenAuthMock.mockImplementation(() => {});
    resolveRegistrySharedTokenUpstreamMock.mockReturnValue({
      ok: true,
      baseUrl: "https://registry.example.com/api/v1",
      token: "registry-shared-token",
    });
  });

  it("forwards fuzzy inbox search requests without charging credits", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "success", data: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest(
      "https://saas.example.com/api/v1/inbox-agent-registration-search?network=Preprod",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "agent@example.com", limit: 5 }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://registry.example.com/api/v1/inbox-agent-registration-search/?network=Preprod",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ query: "agent@example.com", limit: 5 }),
      }),
    );
  });

  it("returns 503 when the registry service is not configured", async () => {
    resolveRegistrySharedTokenUpstreamMock.mockReturnValue({
      ok: false,
      status: 503,
      error: "Registry service is not configured",
    });

    const request = new NextRequest(
      "https://saas.example.com/api/v1/inbox-agent-registration-search?network=Preprod",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "agent@example.com", limit: 5 }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Registry service is not configured",
    });
  });
});
