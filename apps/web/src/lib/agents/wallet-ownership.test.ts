import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const agentFindFirstMock = vi.fn();
const agentFindManyMock = vi.fn();

vi.mock("@masumi/database/client", () => ({
  default: {
    agent: {
      findFirst: agentFindFirstMock,
      findMany: agentFindManyMock,
    },
  },
}));

const getPaymentNodeClientForUserMock = vi.fn();
const tryCreateAdminPaymentNodeClientMock = vi.fn();
const getRegistryEntryForSyncMock = vi.fn();
const tryGetSmartContractAddressMock = vi.fn();

vi.mock("@/lib/payment-node/get-user-client", () => ({
  getPaymentNodeClientForUser: getPaymentNodeClientForUserMock,
}));

vi.mock("@/lib/payment-node/get-admin-client", () => ({
  tryCreateAdminPaymentNodeClient: tryCreateAdminPaymentNodeClientMock,
}));

vi.mock("@/lib/payment-node/resolve-registry-entry-for-sync", () => ({
  getRegistryEntryForSync: getRegistryEntryForSyncMock,
}));

vi.mock("@/lib/payment-node/config", () => ({
  paymentNodeConfig: {
    tryGetSmartContractAddress: tryGetSmartContractAddressMock,
  },
}));

const { getWalletOwnedAgentForUser, listWalletOwnedAgentsForUser } =
  await import("./wallet-ownership");

const SMART_CONTRACT_ADDRESS = "addr_test1wqdech9rs_payment_source";
const EXTERNAL_ID = "registry-entry-1";
const AGENT_IDENTIFIER = "policy+versioned-asset-name";

/** Agent registered via the admin/funding wallet: confirmed on-chain, but the
 *  user's wallet-scoped key cannot enumerate the row (SmartContractWallet is the
 *  funding wallet, not the user's selling wallet). */
function adminMintedConfirmedAgent() {
  return {
    id: "agent-1",
    name: "devint",
    userId: "user-1",
    registrationState: "RegistrationConfirmed",
    agentIdentifier: AGENT_IDENTIFIER,
    networkIdentifier: "Preprod",
    agentReference: {
      externalId: EXTERNAL_ID,
      networkIdentifier: "Preprod",
      sellingWalletVkey: "selling-vkey",
      metadata: { smartContractAddress: SMART_CONTRACT_ADDRESS },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tryGetSmartContractAddressMock.mockReturnValue(undefined);
});

describe("getWalletOwnedAgentForUser", () => {
  it("resolves an admin-minted confirmed agent via the SC-scoped user→admin lookup", async () => {
    const agent = adminMintedConfirmedAgent();
    agentFindFirstMock.mockResolvedValue(agent);
    // User key cannot see the row; getRegistryEntryForSync resolves it via admin.
    getRegistryEntryForSyncMock.mockResolvedValue({
      id: EXTERNAL_ID,
      state: "RegistrationConfirmed",
      agentIdentifier: AGENT_IDENTIFIER,
    });

    const result = await getWalletOwnedAgentForUser({
      userId: "user-1",
      agentId: "agent-1",
    });

    expect(result).toBe(agent);
    expect(getRegistryEntryForSyncMock).toHaveBeenCalledWith({
      userId: "user-1",
      externalId: EXTERNAL_ID,
      network: "Preprod",
      smartContractAddress: SMART_CONTRACT_ADDRESS,
    });
  });

  it("falls back to the admin agent-identifier lookup when there is no external id", async () => {
    const agent = adminMintedConfirmedAgent();
    agent.agentReference.externalId = null;
    agentFindFirstMock.mockResolvedValue(agent);
    const adminGetByIdentifier = vi.fn().mockResolvedValue({
      agentIdentifier: AGENT_IDENTIFIER,
      Metadata: { name: "devint" },
    });
    tryCreateAdminPaymentNodeClientMock.mockReturnValue({
      getRegistryByAgentIdentifier: adminGetByIdentifier,
    });

    const result = await getWalletOwnedAgentForUser({
      userId: "user-1",
      agentId: "agent-1",
    });

    expect(result).toBe(agent);
    expect(getRegistryEntryForSyncMock).not.toHaveBeenCalled();
    expect(adminGetByIdentifier).toHaveBeenCalledWith({
      agentIdentifier: AGENT_IDENTIFIER,
      network: "Preprod",
    });
  });

  it("returns null when neither the sync lookup nor the admin identifier lookup resolves", async () => {
    const agent = adminMintedConfirmedAgent();
    agentFindFirstMock.mockResolvedValue(agent);
    getRegistryEntryForSyncMock.mockResolvedValue(null);
    tryCreateAdminPaymentNodeClientMock.mockReturnValue({
      getRegistryByAgentIdentifier: vi.fn().mockResolvedValue(null),
    });

    const result = await getWalletOwnedAgentForUser({
      userId: "user-1",
      agentId: "agent-1",
    });

    expect(result).toBeNull();
  });
});

describe("listWalletOwnedAgentsForUser", () => {
  it("includes an admin-minted confirmed agent invisible to the user key via the admin SC-scoped enumeration", async () => {
    const agent = adminMintedConfirmedAgent();
    agentFindManyMock.mockResolvedValue([agent]);

    // User key enumeration returns nothing (row is out of its wallet scope).
    getPaymentNodeClientForUserMock.mockResolvedValue({
      getRegistry: vi.fn().mockResolvedValue({ Assets: [] }),
    });
    // Admin key, scoped to the agent's payment source, surfaces the row.
    const adminGetRegistry = vi
      .fn()
      .mockResolvedValueOnce({
        Assets: [{ id: EXTERNAL_ID, agentIdentifier: AGENT_IDENTIFIER }],
      })
      .mockResolvedValue({ Assets: [] });
    tryCreateAdminPaymentNodeClientMock.mockReturnValue({
      getRegistry: adminGetRegistry,
    });

    const result = await listWalletOwnedAgentsForUser({
      userId: "user-1",
      network: "Preprod",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(agent);
    expect(adminGetRegistry).toHaveBeenCalledWith(
      expect.objectContaining({
        network: "Preprod",
        filterSmartContractAddress: SMART_CONTRACT_ADDRESS,
      }),
    );
  });

  it("excludes a confirmed agent that neither the user key nor the admin source enumeration can see", async () => {
    const agent = adminMintedConfirmedAgent();
    agentFindManyMock.mockResolvedValue([agent]);
    getPaymentNodeClientForUserMock.mockResolvedValue({
      getRegistry: vi.fn().mockResolvedValue({ Assets: [] }),
    });
    tryCreateAdminPaymentNodeClientMock.mockReturnValue({
      getRegistry: vi.fn().mockResolvedValue({ Assets: [] }),
    });

    const result = await listWalletOwnedAgentsForUser({
      userId: "user-1",
      network: "Preprod",
    });

    expect(result).toHaveLength(0);
  });

  it("keeps pending agents locally visible without any payment-node lookup", async () => {
    const pendingAgent = {
      ...adminMintedConfirmedAgent(),
      registrationState: "RegistrationRequested",
      agentIdentifier: null,
    };
    agentFindManyMock.mockResolvedValue([pendingAgent]);
    getPaymentNodeClientForUserMock.mockResolvedValue({
      getRegistry: vi.fn().mockResolvedValue({ Assets: [] }),
    });
    tryCreateAdminPaymentNodeClientMock.mockReturnValue(null);

    const result = await listWalletOwnedAgentsForUser({
      userId: "user-1",
      network: "Preprod",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(pendingAgent);
  });
});
