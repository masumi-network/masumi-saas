import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const requireNetworkedOidcApiScopeMock = vi.fn();
const executeCreditChargedProxyWriteMock = vi.fn();
const resolvePaymentUserTokenUpstreamMock = vi.fn();

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: handleAuthErrorMock,
}));

vi.mock("@/lib/auth/oidc-api-permissions", () => ({
  requireNetworkedOidcApiScope: requireNetworkedOidcApiScopeMock,
}));

vi.mock("@/lib/v1-proxy/credit-charged-proxy-write", () => ({
  executeCreditChargedProxyWrite: executeCreditChargedProxyWriteMock,
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
    getEffectivePaymentNetwork: () => "Preprod",
    resolvePaymentUserTokenUpstream: resolvePaymentUserTokenUpstreamMock,
    toUpstreamResponse: async (response: Response) => {
      const text = await response.text();
      return Response.json(JSON.parse(text), { status: response.status });
    },
  };
});

describe("/pay/api/v1/payment", () => {
  let GET: typeof import("./route").GET;
  let POST: typeof import("./route").POST;

  beforeAll(async () => {
    ({ GET, POST } = await import("./route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    handleAuthErrorMock.mockReturnValue(null);
    getAuthenticatedOrThrowMock.mockResolvedValue({
      user: { id: "user-1" },
      authMethod: "session",
    });
    requireNetworkedOidcApiScopeMock.mockImplementation(() => {});
    executeCreditChargedProxyWriteMock.mockImplementation(
      async (params: {
        upstreamBaseUrl: string;
        upstreamPath: string;
        request: Request;
        method: string;
        body?: string;
        token: string;
      }) => {
        const response = await fetch(
          `${params.upstreamBaseUrl}${params.upstreamPath}${new URL(params.request.url).search}`,
          {
            method: params.method,
            headers: { token: params.token },
            body: params.body,
          },
        );
        const text = await response.text();
        return Response.json(JSON.parse(text), { status: response.status });
      },
    );
    resolvePaymentUserTokenUpstreamMock.mockResolvedValue({
      ok: true,
      baseUrl: "https://payment.example.com/api/v1",
      token: "payment-user-token",
    });
  });

  it("forwards POST requests and consumes a credit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest(
      "https://saas.example.com/pay/api/v1/payment?network=Preprod",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 1 }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(requireNetworkedOidcApiScopeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        authMethod: "session",
      }),
      {
        resource: "payments",
        action: "write",
        network: "Preprod",
      },
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://payment.example.com/api/v1/payment?network=Preprod",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ amount: 1 }),
      }),
    );
    expect(executeCreditChargedProxyWriteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        network: "Preprod",
        routePath: "payment",
        upstreamPath: "/payment",
        method: "POST",
        authMethod: "session",
      }),
    );
  });

  it("forwards GET requests without consuming a credit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "success", data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest(
      "https://saas.example.com/pay/api/v1/payment?network=Preprod",
      { method: "GET" },
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(requireNetworkedOidcApiScopeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        authMethod: "session",
      }),
      {
        resource: "payments",
        action: "read",
        network: "Preprod",
      },
    );
    expect(executeCreditChargedProxyWriteMock).not.toHaveBeenCalled();
  });
});
