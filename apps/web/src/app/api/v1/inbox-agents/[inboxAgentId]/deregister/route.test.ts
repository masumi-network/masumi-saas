import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const requireNetworkedOidcApiScopeMock = vi.fn();
const createInboxAdminPaymentNodeClientMock = vi.fn();
const getOwnedInboxAgentForUserMock = vi.fn();
const resolveInboxSmartContractAddressMock = vi.fn();
const saveInboxAgentReferenceMock = vi.fn();

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: handleAuthErrorMock,
}));

vi.mock("@/lib/auth/oidc-api-permissions", () => ({
  requireNetworkedOidcApiScope: requireNetworkedOidcApiScopeMock,
}));

vi.mock("@/lib/inbox-agents/server", () => ({
  createInboxAdminPaymentNodeClient: createInboxAdminPaymentNodeClientMock,
  getOwnedInboxAgentForUser: getOwnedInboxAgentForUserMock,
  resolveInboxSmartContractAddress: resolveInboxSmartContractAddressMock,
  saveInboxAgentReference: saveInboxAgentReferenceMock,
}));

vi.mock("@/lib/v1-proxy/explicit-route-support", () => ({
  getEffectivePaymentNetwork: (request: NextRequest) => {
    const value =
      request.nextUrl.searchParams.get("network") ??
      request.cookies.get("payment_network")?.value;
    return value === "Mainnet" || value === "Preprod" ? value : "Preprod";
  },
}));

describe("POST /pay/api/v1/inbox-agents/:id/deregister", () => {
  let POST: typeof import("./route").POST;

  const inboxAgent = {
    error: null,
    id: "inbox-1",
    name: "Support inbox",
    description: "Routes support requests",
    agentSlug: "support-inbox",
    state: "RegistrationConfirmed",
    createdAt: "2026-04-13T10:00:00.000Z",
    updatedAt: "2026-04-13T10:01:00.000Z",
    lastCheckedAt: "2026-04-13T10:02:00.000Z",
    agentIdentifier: "policy.asset",
    metadataVersion: 1,
    sendFundingLovelace: null,
    SmartContractWallet: {
      walletVkey: "funding_vkey",
      walletAddress: "addr_test1funding",
    },
    RecipientWallet: {
      walletVkey: "funding_vkey",
      walletAddress: "addr_test1funding",
    },
    CurrentTransaction: null,
  } as const;

  const reference = {
    id: "ref-1",
    paymentNodeId: "inbox-1",
    executingWalletId: "funding-1",
    executingWalletVkey: "funding_vkey",
    executingWalletAddress: "addr_test1funding",
    smartContractAddress: "addr_test1contract",
  } as const;

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
    saveInboxAgentReferenceMock.mockResolvedValue(undefined);
  });

  it("deregisters through the admin key after ownership and scope checks pass", async () => {
    const deregistered = {
      ...inboxAgent,
      state: "DeregistrationRequested",
    };
    const deregisterInboxAgentMock = vi.fn().mockResolvedValue(deregistered);
    createInboxAdminPaymentNodeClientMock.mockReturnValue({
      deregisterInboxAgent: deregisterInboxAgentMock,
    });
    getOwnedInboxAgentForUserMock.mockResolvedValue({
      source: "db",
      reference,
      entry: inboxAgent,
      executingWallet: {
        id: "funding-1",
        walletVkey: "funding_vkey",
        walletAddress: "addr_test1funding",
      },
      smartContractAddress: "addr_test1contract",
    });

    const response = await POST(
      new NextRequest(
        "https://saas.example.com/pay/api/v1/inbox-agents/inbox-1/deregister?network=Preprod",
        { method: "POST" },
      ),
      { params: Promise.resolve({ inboxAgentId: "inbox-1" }) },
    );

    expect(response.status).toBe(200);
    expect(requireNetworkedOidcApiScopeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { id: "user-1" },
      }),
      {
        resource: "inbox-agents",
        action: "write",
        network: "Preprod",
      },
    );
    expect(createInboxAdminPaymentNodeClientMock).toHaveBeenCalledTimes(1);
    expect(deregisterInboxAgentMock).toHaveBeenCalledWith({
      network: "Preprod",
      agentIdentifier: "policy.asset",
      smartContractAddress: "addr_test1contract",
    });
    expect(saveInboxAgentReferenceMock).toHaveBeenCalledWith({
      userId: "user-1",
      network: "Preprod",
      entry: deregistered,
      executingWallet: {
        id: "funding-1",
        walletVkey: "funding_vkey",
        walletAddress: "addr_test1funding",
      },
      smartContractAddress: "addr_test1contract",
    });
  });

  it("does not create a payment-node client when ownership is missing", async () => {
    getOwnedInboxAgentForUserMock.mockResolvedValue(null);

    const response = await POST(
      new NextRequest(
        "https://saas.example.com/pay/api/v1/inbox-agents/inbox-1/deregister?network=Preprod",
        { method: "POST" },
      ),
      { params: Promise.resolve({ inboxAgentId: "inbox-1" }) },
    );

    expect(response.status).toBe(404);
    expect(createInboxAdminPaymentNodeClientMock).not.toHaveBeenCalled();
  });

  it("does not create the admin client when the owned inbox is not deregisterable", async () => {
    getOwnedInboxAgentForUserMock.mockResolvedValue({
      source: "db",
      reference,
      entry: {
        ...inboxAgent,
        state: "RegistrationInitiated",
      },
      executingWallet: {
        id: "funding-1",
        walletVkey: "funding_vkey",
        walletAddress: "addr_test1funding",
      },
      smartContractAddress: "addr_test1contract",
    });

    const response = await POST(
      new NextRequest(
        "https://saas.example.com/pay/api/v1/inbox-agents/inbox-1/deregister?network=Preprod",
        { method: "POST" },
      ),
      { params: Promise.resolve({ inboxAgentId: "inbox-1" }) },
    );

    expect(response.status).toBe(400);
    expect(createInboxAdminPaymentNodeClientMock).not.toHaveBeenCalled();
  });

  it("returns 503 when admin payment-node config is missing", async () => {
    const { PaymentNodeConfigError } =
      await import("@/lib/payment-node/config");
    getOwnedInboxAgentForUserMock.mockResolvedValue({
      source: "db",
      reference,
      entry: inboxAgent,
      executingWallet: {
        id: "funding-1",
        walletVkey: "funding_vkey",
        walletAddress: "addr_test1funding",
      },
      smartContractAddress: "addr_test1contract",
    });
    createInboxAdminPaymentNodeClientMock.mockImplementation(() => {
      throw new PaymentNodeConfigError(
        "PAYMENT_NODE_ADMIN_KEY is required for payment node integration",
      );
    });

    const response = await POST(
      new NextRequest(
        "https://saas.example.com/pay/api/v1/inbox-agents/inbox-1/deregister?network=Preprod",
        { method: "POST" },
      ),
      { params: Promise.resolve({ inboxAgentId: "inbox-1" }) },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toStrictEqual({
      success: false,
      error: "PAYMENT_NODE_ADMIN_KEY is required for payment node integration",
    });
    expect(saveInboxAgentReferenceMock).not.toHaveBeenCalled();
  });
});
