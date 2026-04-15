import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const requireNetworkedOidcApiScopeMock = vi.fn();
const getWalletOwnedAgentForUserMock = vi.fn();
const deregisterAgentForUserMock = vi.fn();

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: handleAuthErrorMock,
}));

vi.mock("@/lib/auth/oidc-api-permissions", () => ({
  requireNetworkedOidcApiScope: requireNetworkedOidcApiScopeMock,
}));

vi.mock("@/lib/agents/wallet-ownership", () => ({
  getWalletOwnedAgentForUser: getWalletOwnedAgentForUserMock,
}));

vi.mock("@/lib/deregister-agent", () => ({
  deregisterAgentForUser: deregisterAgentForUserMock,
}));

describe("/api/agents/[agentId]/deregister POST", () => {
  let POST: typeof import("./route").POST;

  beforeAll(async () => {
    ({ POST } = await import("./route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    handleAuthErrorMock.mockReturnValue(null);
    getAuthenticatedOrThrowMock.mockResolvedValue({
      user: { id: "user-1" },
    });
    requireNetworkedOidcApiScopeMock.mockImplementation(() => {});
    getWalletOwnedAgentForUserMock.mockResolvedValue({
      id: "agent-1",
      networkIdentifier: "Mainnet",
    });
  });

  it("returns 503 when Mainnet payment-source config is missing", async () => {
    const { PaymentNodeConfigError } =
      await import("@/lib/payment-node/config");
    deregisterAgentForUserMock.mockRejectedValue(
      new PaymentNodeConfigError(
        "PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET is required for Mainnet payment-source operations",
      ),
    );

    const request = new NextRequest(
      "https://saas.example.com/api/agents/agent-1/deregister",
      {
        method: "POST",
        headers: {
          Cookie: "payment_network=Mainnet",
        },
      },
    );

    const response = await POST(request, {
      params: Promise.resolve({ agentId: "agent-1" }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toStrictEqual({
      success: false,
      error:
        "PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET is required for Mainnet payment-source operations",
    });
  });
});
