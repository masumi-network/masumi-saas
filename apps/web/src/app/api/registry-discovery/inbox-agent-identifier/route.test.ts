import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const requireNetworkedOidcApiScopeMock = vi.fn();
const createInboxAdminPaymentNodeClientMock = vi.fn();
const getRegisteredOwnedInboxAgentReferenceByAgentIdentifierMock = vi.fn();

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: handleAuthErrorMock,
}));

vi.mock("@/lib/auth/oidc-api-permissions", () => ({
  requireNetworkedOidcApiScope: requireNetworkedOidcApiScopeMock,
}));

vi.mock("@/lib/inbox-agents/server", () => ({
  createInboxAdminPaymentNodeClient: createInboxAdminPaymentNodeClientMock,
  getRegisteredOwnedInboxAgentReferenceByAgentIdentifier:
    getRegisteredOwnedInboxAgentReferenceByAgentIdentifierMock,
}));

vi.mock("@/lib/payment-node/config", () => ({
  isPaymentNodeConfigError: (error: unknown) =>
    error instanceof Error && error.name === "PaymentNodeConfigError",
}));

vi.mock("@/lib/v1-proxy/explicit-route-support", () => ({
  getEffectivePaymentNetwork: () => "Preprod",
}));

describe("GET /pay/api/v1/registry-inbox/agent-identifier", () => {
  let GET: typeof import("./route").GET;

  beforeAll(async () => {
    ({ GET } = await import("./route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    handleAuthErrorMock.mockReturnValue(null);
    getAuthenticatedOrThrowMock.mockResolvedValue({
      user: { id: "user-1" },
      authMethod: "session",
    });
    requireNetworkedOidcApiScopeMock.mockImplementation(() => {});
  });

  it("looks up raw metadata through the admin payment-node key after registered ownership is found", async () => {
    const metadata = {
      policyId: "policy",
      assetName: "asset",
      agentIdentifier: "policy.asset",
      Metadata: {
        name: "Support inbox",
        description: "Routes support requests",
        agentSlug: "support-inbox",
        metadataVersion: 1,
      },
    };
    getRegisteredOwnedInboxAgentReferenceByAgentIdentifierMock.mockResolvedValue(
      {
        id: "ref-1",
        state: "RegistrationConfirmed",
      },
    );
    const getRegistryInboxByAgentIdentifierMock = vi
      .fn()
      .mockResolvedValue(metadata);
    createInboxAdminPaymentNodeClientMock.mockReturnValue({
      getRegistryInboxByAgentIdentifier: getRegistryInboxByAgentIdentifierMock,
    });

    const response = await GET(
      new NextRequest(
        "https://saas.example.com/pay/api/v1/registry-inbox/agent-identifier?agentIdentifier=policy.asset&network=Preprod",
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({
      success: true,
      data: metadata,
    });
    expect(
      getRegisteredOwnedInboxAgentReferenceByAgentIdentifierMock,
    ).toHaveBeenCalledWith({
      userId: "user-1",
      network: "Preprod",
      agentIdentifier: "policy.asset",
    });
    expect(getRegistryInboxByAgentIdentifierMock).toHaveBeenCalledWith({
      agentIdentifier: "policy.asset",
      network: "Preprod",
    });
    expect(createInboxAdminPaymentNodeClientMock).toHaveBeenCalled();
  });

  it("does not call the payment node when ownership is missing", async () => {
    getRegisteredOwnedInboxAgentReferenceByAgentIdentifierMock.mockResolvedValue(
      null,
    );

    const response = await GET(
      new NextRequest(
        "https://saas.example.com/pay/api/v1/registry-inbox/agent-identifier?agentIdentifier=policy.asset&network=Preprod",
      ),
    );

    expect(response.status).toBe(404);
    expect(createInboxAdminPaymentNodeClientMock).not.toHaveBeenCalled();
  });

  it("returns 503 when admin payment-node config is missing", async () => {
    getRegisteredOwnedInboxAgentReferenceByAgentIdentifierMock.mockResolvedValue(
      {
        id: "ref-1",
        state: "RegistrationConfirmed",
      },
    );
    createInboxAdminPaymentNodeClientMock.mockImplementation(() => {
      throw Object.assign(new Error("PAYMENT_NODE_ADMIN_API_KEY is required"), {
        name: "PaymentNodeConfigError",
      });
    });

    const response = await GET(
      new NextRequest(
        "https://saas.example.com/pay/api/v1/registry-inbox/agent-identifier?agentIdentifier=policy.asset&network=Preprod",
      ),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toStrictEqual({
      success: false,
      error: "PAYMENT_NODE_ADMIN_API_KEY is required",
    });
  });
});
