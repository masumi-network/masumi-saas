import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getAuthenticatedOrThrowMock = vi.fn();
const handleAuthErrorMock = vi.fn();
const requireNetworkedOidcApiScopeMock = vi.fn();
const getPaymentNodeClientForUserMock = vi.fn();
const deleteInboxAgentReferenceMock = vi.fn();
const getOwnedInboxAgentForUserMock = vi.fn();

vi.mock("@/lib/auth/utils", () => ({
  getAuthenticatedOrThrow: getAuthenticatedOrThrowMock,
  handleAuthError: handleAuthErrorMock,
}));

vi.mock("@/lib/auth/oidc-api-permissions", () => ({
  requireNetworkedOidcApiScope: requireNetworkedOidcApiScopeMock,
}));

vi.mock("@/lib/inbox-agents/server", () => ({
  deleteInboxAgentReference: deleteInboxAgentReferenceMock,
  getOwnedInboxAgentForUser: getOwnedInboxAgentForUserMock,
}));

vi.mock("@/lib/payment-node/get-user-client", () => ({
  getPaymentNodeClientForUser: getPaymentNodeClientForUserMock,
}));

vi.mock("@/lib/v1-proxy/explicit-route-support", () => ({
  getEffectivePaymentNetwork: (request: NextRequest) => {
    const value =
      request.nextUrl.searchParams.get("network") ??
      request.cookies.get("payment_network")?.value;
    return value === "Mainnet" || value === "Preprod" ? value : "Preprod";
  },
}));

describe("DELETE /pay/api/v1/inbox-agents/:id", () => {
  let DELETE: typeof import("./route").DELETE;

  const inboxAgent = {
    error: null,
    id: "inbox-1",
    name: "Support inbox",
    description: "Routes support requests",
    agentSlug: "support-inbox",
    state: "RegistrationFailed",
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

  beforeAll(async () => {
    ({ DELETE } = await import("./route"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    handleAuthErrorMock.mockReturnValue(null);
    getAuthenticatedOrThrowMock.mockResolvedValue({
      user: { id: "user-1" },
      authMethod: "session",
    });
    requireNetworkedOidcApiScopeMock.mockImplementation(() => {});
    deleteInboxAgentReferenceMock.mockResolvedValue(undefined);
  });

  it("deletes through the user payment-node key after ownership is found", async () => {
    const deleteRegistryInboxEntryMock = vi.fn().mockResolvedValue(inboxAgent);
    getPaymentNodeClientForUserMock.mockResolvedValue({
      deleteRegistryInboxEntry: deleteRegistryInboxEntryMock,
    });
    getOwnedInboxAgentForUserMock.mockResolvedValue({
      source: "db",
      reference: { id: "ref-1" },
      entry: inboxAgent,
      executingWallet: {
        id: "funding-1",
        walletVkey: "funding_vkey",
        walletAddress: "addr_test1funding",
      },
      smartContractAddress: "addr_test1contract",
    });

    const response = await DELETE(
      new NextRequest(
        "https://saas.example.com/pay/api/v1/inbox-agents/inbox-1?network=Preprod",
        { method: "DELETE" },
      ),
      { params: Promise.resolve({ inboxAgentId: "inbox-1" }) },
    );

    expect(response.status).toBe(200);
    expect(getOwnedInboxAgentForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      network: "Preprod",
      inboxAgentId: "inbox-1",
    });
    expect(getPaymentNodeClientForUserMock).toHaveBeenCalledWith("user-1");
    expect(deleteRegistryInboxEntryMock).toHaveBeenCalledWith("inbox-1");
    expect(deleteInboxAgentReferenceMock).toHaveBeenCalledWith("ref-1");
  });

  it("does not create a payment-node client when ownership is missing", async () => {
    getOwnedInboxAgentForUserMock.mockResolvedValue(null);

    const response = await DELETE(
      new NextRequest(
        "https://saas.example.com/pay/api/v1/inbox-agents/inbox-1?network=Preprod",
        { method: "DELETE" },
      ),
      { params: Promise.resolve({ inboxAgentId: "inbox-1" }) },
    );

    expect(response.status).toBe(404);
    expect(getPaymentNodeClientForUserMock).not.toHaveBeenCalled();
  });

  it("does not delete local DB references when the remote lookup is inconclusive", async () => {
    const staleInboxAgent = {
      ...inboxAgent,
      state: "RegistrationInitiated",
    };
    getOwnedInboxAgentForUserMock.mockResolvedValue({
      source: "db",
      reference: { id: "ref-stale" },
      entry: staleInboxAgent,
      executingWallet: {
        id: "funding-1",
        walletVkey: "funding_vkey",
        walletAddress: "addr_test1funding",
      },
      smartContractAddress: "addr_test1contract",
    });

    const response = await DELETE(
      new NextRequest(
        "https://saas.example.com/pay/api/v1/inbox-agents/inbox-1?network=Preprod",
        { method: "DELETE" },
      ),
      { params: Promise.resolve({ inboxAgentId: "inbox-1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toStrictEqual({
      success: false,
      error:
        "Inbox agent can only be deleted after a failed registration or completed deregistration",
    });
    expect(deleteInboxAgentReferenceMock).not.toHaveBeenCalled();
    expect(getPaymentNodeClientForUserMock).not.toHaveBeenCalled();
  });
});
