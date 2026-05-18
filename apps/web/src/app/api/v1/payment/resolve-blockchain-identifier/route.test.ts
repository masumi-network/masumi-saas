import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const requireNetworkedOidcApiScopeMock = vi.fn();
const consumeCreditIfRequiredMock = vi.fn();
const resolvePaymentUserTokenUpstreamMock = vi.fn();
const getEffectivePaymentNetworkMock = vi.fn(
  (_request: NextRequest, body?: string) => {
    if (!body) {
      return "Mainnet";
    }

    const parsed = JSON.parse(body) as { network?: string };
    return parsed.network === "Preprod" ? "Preprod" : "Mainnet";
  },
);

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: handleAuthErrorMock,
}));

vi.mock("@/lib/auth/oidc-api-permissions", () => ({
  requireNetworkedOidcApiScope: requireNetworkedOidcApiScopeMock,
}));

vi.mock("@/lib/credits/service", () => ({
  consumeCreditIfRequired: consumeCreditIfRequiredMock,
  createCreditReference: () => "payment-proxy-write:test",
}));

vi.mock("@/lib/v1-proxy/explicit-route-support", () => ({
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
  getEffectivePaymentNetwork: getEffectivePaymentNetworkMock,
  resolvePaymentUserTokenUpstream: resolvePaymentUserTokenUpstreamMock,
  toUpstreamResponse: async (response: Response) => {
    const text = await response.text();
    return Response.json(JSON.parse(text), { status: response.status });
  },
}));

describe("/pay/api/v1/payment/resolve-blockchain-identifier", () => {
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
    requireNetworkedOidcApiScopeMock.mockImplementation(() => {});
    consumeCreditIfRequiredMock.mockResolvedValue({
      creditsRemaining: 0,
      updatedAt: new Date("2026-04-13T10:00:00.000Z"),
    });
    resolvePaymentUserTokenUpstreamMock.mockResolvedValue({
      ok: true,
      baseUrl: "https://payment.example.com/api/v1",
      token: "payment-user-token",
    });
  });

  it("reuses the body-derived network for scope checks and credit consumption", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const body = JSON.stringify({ network: "Preprod", transactionId: "tx-1" });
    const request = new NextRequest(
      "https://saas.example.com/pay/api/v1/payment/resolve-blockchain-identifier",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(getEffectivePaymentNetworkMock).toHaveBeenCalledTimes(1);
    expect(getEffectivePaymentNetworkMock).toHaveBeenCalledWith(
      expect.any(Request),
      body,
    );
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
    expect(consumeCreditIfRequiredMock).toHaveBeenCalledWith({
      userId: "user-1",
      reason: "payment_proxy_write",
      reference: "payment-proxy-write:test",
      network: "Preprod",
      metadata: {
        method: "POST",
        route: "payment/resolve-blockchain-identifier",
        upstreamPath: "/payment/resolve-blockchain-identifier",
        network: "Preprod",
        authMethod: "session",
      },
    });
  });
});
