import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const rejectOidcAccessTokenAuthMock = vi.fn();
const consumeCreditOrThrowMock = vi.fn();
const resolvePaymentUserTokenUpstreamMock = vi.fn();

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: handleAuthErrorMock,
}));

vi.mock("@/lib/auth/oidc-api-permissions", () => ({
  rejectOidcAccessTokenAuth: rejectOidcAccessTokenAuthMock,
}));

vi.mock("@/lib/credits/service", () => ({
  consumeCreditOrThrow: consumeCreditOrThrowMock,
  createCreditReference: () => "payment-proxy-write:test",
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
    resolvePaymentUserTokenUpstream: resolvePaymentUserTokenUpstreamMock,
    toUpstreamResponse: async (response: Response) => {
      const text = await response.text();
      return Response.json(JSON.parse(text), { status: response.status });
    },
  };
});

describe("/api/v1/payment", () => {
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
    rejectOidcAccessTokenAuthMock.mockImplementation(() => {});
    consumeCreditOrThrowMock.mockResolvedValue({
      creditsRemaining: 0,
      updatedAt: new Date("2026-04-13T10:00:00.000Z"),
    });
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
      "https://saas.example.com/api/v1/payment?network=Preprod",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 1 }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://payment.example.com/api/v1/payment?network=Preprod",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ amount: 1 }),
      }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("token")).toBe("payment-user-token");
    expect(consumeCreditOrThrowMock).toHaveBeenCalledWith({
      userId: "user-1",
      reason: "payment_proxy_write",
      reference: "payment-proxy-write:test",
      metadata: {
        method: "POST",
        route: "payment",
        upstreamPath: "/payment",
        network: "Preprod",
        authMethod: "session",
      },
    });
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
      "https://saas.example.com/api/v1/payment?network=Preprod",
      { method: "GET" },
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(consumeCreditOrThrowMock).not.toHaveBeenCalled();
  });
});
