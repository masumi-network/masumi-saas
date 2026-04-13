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

describe("/api/v1/registry", () => {
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

  it("forwards registry writes and consumes a credit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest(
      "https://saas.example.com/api/v1/registry?network=Preprod",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Agent" }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://payment.example.com/api/v1/registry?network=Preprod",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Agent" }),
      }),
    );
    expect(consumeCreditOrThrowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "payment_proxy_write",
        metadata: expect.objectContaining({
          route: "registry",
          upstreamPath: "/registry",
          network: "Preprod",
        }),
      }),
    );
  });
});
