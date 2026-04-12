import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const rejectOidcAccessTokenAuthMock = vi.fn();
const getPaymentNodeApiKeyTokenForUserMock = vi.fn();
const paymentNodeGetBaseUrlMock = vi.fn();
const registryServiceGetApiKeyMock = vi.fn();
const registryServiceGetBaseUrlMock = vi.fn();
const getProxyRouteDescriptorMock = vi.fn();
const normalizeProxyPathSegmentsMock = vi.fn();

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: handleAuthErrorMock,
}));

vi.mock("@/lib/auth/oidc-api-permissions", () => ({
  rejectOidcAccessTokenAuth: rejectOidcAccessTokenAuthMock,
}));

vi.mock("@/lib/payment-node/get-user-client", () => ({
  getPaymentNodeApiKeyTokenForUser: getPaymentNodeApiKeyTokenForUserMock,
}));

vi.mock("@/lib/payment-node/config", () => ({
  paymentNodeConfig: {
    getBaseUrl: paymentNodeGetBaseUrlMock,
  },
}));

vi.mock("@/lib/registry-service", () => ({
  registryServiceConfig: {
    getApiKey: registryServiceGetApiKeyMock,
    getBaseUrl: registryServiceGetBaseUrlMock,
  },
}));

vi.mock("@/lib/v1-proxy/manifest", () => ({
  getProxyRouteDescriptor: getProxyRouteDescriptorMock,
}));

vi.mock("@/lib/v1-proxy/path", () => ({
  normalizeProxyPathSegments: normalizeProxyPathSegmentsMock,
}));

describe("/api/v1 proxy route", () => {
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
    normalizeProxyPathSegmentsMock.mockImplementation(
      (segments?: string[]) => ({
        ok: true,
        normalizedPath: (segments ?? []).join("/"),
      }),
    );
  });

  it("forwards payment routes with the per-user token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    paymentNodeGetBaseUrlMock.mockReturnValue(
      "https://payment.example.com/api/v1",
    );
    getPaymentNodeApiKeyTokenForUserMock.mockResolvedValue(
      "payment-user-token",
    );
    getProxyRouteDescriptorMock.mockReturnValue({
      upstream: "payment",
      upstreamPath: "/payment",
      authMode: "payment-user-token",
    });

    const request = new NextRequest(
      "https://saas.example.com/api/v1/payment?network=Preprod",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 1 }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ path: ["payment"] }),
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://payment.example.com/api/v1/payment?network=Preprod",
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("token")).toBe("payment-user-token");
    expect(init.body).toBe(JSON.stringify({ amount: 1 }));
  });

  it("forwards registry routes with the shared registry token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    registryServiceGetApiKeyMock.mockReturnValue("registry-shared-token");
    registryServiceGetBaseUrlMock.mockReturnValue(
      "https://registry.example.com/api/v1",
    );
    getProxyRouteDescriptorMock.mockReturnValue({
      upstream: "registry",
      upstreamPath: "/registry-entry/",
      authMode: "registry-shared-token",
    });

    const request = new NextRequest(
      "https://saas.example.com/api/v1/registry-entry?network=Preprod",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 5 }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ path: ["registry-entry"] }),
    });

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://registry.example.com/api/v1/registry-entry/?network=Preprod",
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("token")).toBe("registry-shared-token");
    expect(init.body).toBe(JSON.stringify({ limit: 5 }));
  });

  it("returns 503 when a registry route is requested without registry config", async () => {
    registryServiceGetApiKeyMock.mockImplementation(() => {
      throw new Error("missing");
    });
    getProxyRouteDescriptorMock.mockReturnValue({
      upstream: "registry",
      upstreamPath: "/registry-entry/",
      authMode: "registry-shared-token",
    });

    const request = new NextRequest(
      "https://saas.example.com/api/v1/registry-entry?network=Preprod",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 5 }),
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ path: ["registry-entry"] }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "Registry service is not configured",
    });
  });

  it("rejects non-allowlisted registry admin paths before fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest(
      "https://saas.example.com/api/v1/registry-source",
      { method: "GET" },
    );
    getProxyRouteDescriptorMock.mockReturnValue(undefined);

    const response = await GET(request, {
      params: Promise.resolve({ path: ["registry-source"] }),
    });

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
