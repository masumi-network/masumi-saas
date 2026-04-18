import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createPaymentNodeClientMock = vi.fn();
const getBaseUrlMock = vi.fn();
const getAdminApiKeyMock = vi.fn();
const getPaymentSourceIdMock = vi.fn();
const getPaymentSourceIdEnvNameMock = vi.fn();
const isWalletAddressCompatibleWithNetworkMock = vi.fn();
const resolveRegistrationFundingWalletMock = vi.fn();

const generateWalletMock = vi.fn();
const addWalletsToPaymentSourceMock = vi.fn();
const getPaymentSourcesMock = vi.fn();
const getRegistryInboxByIdMock = vi.fn();
const getPaymentNodeClientForUserMock = vi.fn();
const inboxAgentReferenceCreateMock = vi.fn();
const inboxAgentReferenceDeleteMock = vi.fn();
const inboxAgentReferenceFindFirstMock = vi.fn();
const inboxAgentReferenceFindManyMock = vi.fn();
const inboxAgentReferenceFindUniqueMock = vi.fn();
const inboxAgentReferenceUpdateMock = vi.fn();

vi.mock("@masumi/database/client", () => ({
  default: {
    inboxAgentReference: {
      create: inboxAgentReferenceCreateMock,
      delete: inboxAgentReferenceDeleteMock,
      findFirst: inboxAgentReferenceFindFirstMock,
      findMany: inboxAgentReferenceFindManyMock,
      findUnique: inboxAgentReferenceFindUniqueMock,
      update: inboxAgentReferenceUpdateMock,
    },
  },
}));

vi.mock("@/lib/payment-node/get-user-client", () => ({
  getPaymentNodeClientForUser: getPaymentNodeClientForUserMock,
}));

vi.mock("@/lib/payment-node", () => ({
  createPaymentNodeClient: createPaymentNodeClientMock,
  paymentNodeConfig: {
    getBaseUrl: getBaseUrlMock,
    getAdminApiKey: getAdminApiKeyMock,
    getPaymentSourceId: getPaymentSourceIdMock,
    getPaymentSourceIdEnvName: getPaymentSourceIdEnvNameMock,
  },
}));

vi.mock("@/lib/payment-node/config", () => ({
  isPaymentNodeConfigError: (error: unknown) =>
    error instanceof Error && error.name === "PaymentNodeConfigError",
}));

vi.mock("../payment-node/registration-wallets", () => ({
  isWalletAddressCompatibleWithNetwork:
    isWalletAddressCompatibleWithNetworkMock,
  resolveRegistrationFundingWallet: resolveRegistrationFundingWalletMock,
}));

describe("prepareManagedInboxRegistration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBaseUrlMock.mockReturnValue("https://payment.example.com/api/v1");
    getAdminApiKeyMock.mockReturnValue("admin-key");
    getPaymentSourceIdMock.mockImplementation((network: string) =>
      network === "Mainnet" ? "payment-source-mainnet" : "payment-source-1",
    );
    getPaymentSourceIdEnvNameMock.mockImplementation((network: string) =>
      network === "Mainnet"
        ? "PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET"
        : "PAYMENT_NODE_PAYMENT_SOURCE_ID_PREPROD",
    );
    isWalletAddressCompatibleWithNetworkMock.mockReturnValue(true);
    createPaymentNodeClientMock.mockReturnValue({
      generateWallet: generateWalletMock,
      addWalletsToPaymentSource: addWalletsToPaymentSourceMock,
      getPaymentSources: getPaymentSourcesMock,
      getRegistryInboxById: getRegistryInboxByIdMock,
    });
  });

  it("selects the configured executing wallet without creating a wallet", async () => {
    const fundingWallet = {
      id: "funding-1",
      walletVkey: "funding_vkey",
      walletAddress: "addr_test1funding",
      collectionAddress: null,
      note: "Funding wallet",
    };
    getPaymentSourcesMock.mockResolvedValue({
      PaymentSources: [
        {
          id: "payment-source-1",
          network: "Preprod",
          smartContractAddress: "addr_test1contract",
          SellingWallets: [fundingWallet],
          PurchasingWallets: [],
        },
      ],
    });
    resolveRegistrationFundingWalletMock.mockReturnValue({
      wallet: fundingWallet,
    });

    const { prepareManagedInboxRegistration } = await import("./server");
    const result = await prepareManagedInboxRegistration({
      name: "Support inbox",
      network: "Preprod",
    });

    expect(generateWalletMock).not.toHaveBeenCalled();
    expect(addWalletsToPaymentSourceMock).not.toHaveBeenCalled();
    expect(getPaymentSourcesMock).toHaveBeenCalledWith({
      take: 100,
      cursorId: undefined,
    });
    expect(resolveRegistrationFundingWalletMock).toHaveBeenCalledWith({
      network: "Preprod",
      paymentSourceId: "payment-source-1",
      sellingWallets: [fundingWallet],
    });
    expect(result).toStrictEqual({
      success: true,
      executingWallet: fundingWallet,
      paymentSourceId: "payment-source-1",
      smartContractAddress: "addr_test1contract",
    });
  });

  it("uses the Mainnet payment source configured for Mainnet requests", async () => {
    const fundingWallet = {
      id: "funding-mainnet",
      walletVkey: "funding_vkey_mainnet",
      walletAddress: "addr1funding",
      collectionAddress: null,
      note: "Funding wallet",
    };
    getPaymentSourcesMock.mockResolvedValue({
      PaymentSources: [
        {
          id: "payment-source-mainnet",
          network: "Mainnet",
          smartContractAddress: "addr1contract",
          SellingWallets: [fundingWallet],
          PurchasingWallets: [],
        },
      ],
    });
    resolveRegistrationFundingWalletMock.mockReturnValue({
      wallet: fundingWallet,
    });

    const { prepareManagedInboxRegistration } = await import("./server");
    const result = await prepareManagedInboxRegistration({
      name: "Mainnet inbox",
      network: "Mainnet",
    });

    expect(getPaymentSourceIdMock).toHaveBeenCalledWith("Mainnet");
    expect(generateWalletMock).not.toHaveBeenCalled();
    expect(addWalletsToPaymentSourceMock).not.toHaveBeenCalled();
    expect(result).toStrictEqual({
      success: true,
      executingWallet: fundingWallet,
      paymentSourceId: "payment-source-mainnet",
      smartContractAddress: "addr1contract",
    });
  });

  it("keeps base URL config errors on the generic fallback path", async () => {
    getBaseUrlMock.mockImplementation(() => {
      throw Object.assign(
        new Error(
          "PAYMENT_NODE_BASE_URL is required for payment node integration",
        ),
        {
          name: "PaymentNodeConfigError",
          envName: "PAYMENT_NODE_BASE_URL",
        },
      );
    });

    const { prepareManagedInboxRegistration } = await import("./server");
    const result = await prepareManagedInboxRegistration({
      name: "Mainnet inbox",
      network: "Mainnet",
    });

    expect(result).toStrictEqual({
      success: false,
      error: "Something went wrong. Please try again later.",
    });
  });
});

function makeInboxEntry(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function makeReference(overrides: Record<string, unknown> = {}) {
  const entry = makeInboxEntry(overrides);
  return {
    id: `ref-${entry.id}`,
    userId: "user-1",
    paymentNodeId: entry.id,
    networkIdentifier: "Preprod",
    name: entry.name,
    description: entry.description,
    agentSlug: entry.agentSlug,
    state: entry.state,
    agentIdentifier: entry.agentIdentifier,
    executingWalletId: "funding-1",
    executingWalletVkey: "funding_vkey",
    executingWalletAddress: "addr_test1funding",
    smartContractAddress: "addr_test1contract",
    registryEntry: entry,
    createdAt: new Date(entry.createdAt),
    updatedAt: new Date(entry.updatedAt),
    ...overrides,
  };
}

describe("listOwnedInboxAgentsForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBaseUrlMock.mockReturnValue("https://payment.example.com/api/v1");
    getAdminApiKeyMock.mockReturnValue("admin-key");
    getRegistryInboxByIdMock.mockResolvedValue(null);
    inboxAgentReferenceFindUniqueMock.mockResolvedValue(null);
    inboxAgentReferenceCreateMock.mockImplementation(async ({ data }) => ({
      id: `ref-${data.paymentNodeId}`,
      createdAt: new Date("2026-04-13T10:00:00.000Z"),
      updatedAt: new Date("2026-04-13T10:01:00.000Z"),
      ...data,
    }));
    createPaymentNodeClientMock.mockReturnValue({
      getPaymentSources: getPaymentSourcesMock,
      getRegistryInboxById: getRegistryInboxByIdMock,
    });
  });

  it("lists legacy inboxes owned by scoped recipient wallets without persisting them", async () => {
    const legacyEntry = makeInboxEntry({
      id: "legacy-1",
      RecipientWallet: {
        walletVkey: "legacy_recipient_vkey",
        walletAddress: "addr_test1recipient",
      },
    });
    const legacyGetRegistryInboxMock = vi.fn().mockResolvedValue({
      Assets: [legacyEntry],
    });
    getPaymentNodeClientForUserMock.mockResolvedValue({
      getApiKeyStatus: vi.fn().mockResolvedValue({
        WalletScopes: [{ hotWalletId: "managed-1" }],
      }),
      getRegistryInbox: legacyGetRegistryInboxMock,
    });
    getPaymentSourcesMock.mockResolvedValue({
      PaymentSources: [
        {
          id: "payment-source-1",
          network: "Preprod",
          smartContractAddress: "addr_test1contract",
          SellingWallets: [
            {
              id: "funding-1",
              walletVkey: "funding_vkey",
              walletAddress: "addr_test1funding",
              collectionAddress: null,
              note: "Funding wallet",
            },
            {
              id: "managed-1",
              walletVkey: "legacy_recipient_vkey",
              walletAddress: "addr_test1recipient",
              collectionAddress: null,
              note: "Legacy inbox recipient",
            },
          ],
          PurchasingWallets: [],
        },
      ],
    });
    inboxAgentReferenceFindManyMock.mockResolvedValue([]);

    const { listOwnedInboxAgentsForUser } = await import("./server");
    const result = await listOwnedInboxAgentsForUser({
      userId: "user-1",
      network: "Preprod",
      take: 10,
    });

    expect(legacyGetRegistryInboxMock).toHaveBeenCalledWith({
      network: "Preprod",
      cursorId: undefined,
      limit: 100,
    });
    expect(inboxAgentReferenceCreateMock).not.toHaveBeenCalled();
    expect(inboxAgentReferenceUpdateMock).not.toHaveBeenCalled();
    expect(result.Assets).toHaveLength(1);
    expect(result.Assets[0]?.id).toBe("legacy-1");
  });

  it("does not backfill inboxes without a scoped legacy recipient wallet", async () => {
    const sharedRecipientEntry = makeInboxEntry({
      id: "shared-recipient",
    });
    const unscopedRecipientEntry = makeInboxEntry({
      id: "unscoped-recipient",
      RecipientWallet: {
        walletVkey: "other_recipient_vkey",
        walletAddress: "addr_test1other",
      },
    });
    const legacyGetRegistryInboxMock = vi.fn().mockResolvedValue({
      Assets: [sharedRecipientEntry, unscopedRecipientEntry],
    });
    getPaymentNodeClientForUserMock.mockResolvedValue({
      getApiKeyStatus: vi.fn().mockResolvedValue({
        WalletScopes: [{ hotWalletId: "managed-1" }],
      }),
      getRegistryInbox: legacyGetRegistryInboxMock,
    });
    getPaymentSourcesMock.mockResolvedValue({
      PaymentSources: [
        {
          id: "payment-source-1",
          network: "Preprod",
          smartContractAddress: "addr_test1contract",
          SellingWallets: [
            {
              id: "funding-1",
              walletVkey: "funding_vkey",
              walletAddress: "addr_test1funding",
              collectionAddress: null,
              note: "Funding wallet",
            },
            {
              id: "other-managed",
              walletVkey: "other_recipient_vkey",
              walletAddress: "addr_test1other",
              collectionAddress: null,
              note: "Another user's legacy inbox recipient",
            },
          ],
          PurchasingWallets: [],
        },
      ],
    });
    inboxAgentReferenceFindManyMock.mockResolvedValue([]);

    const { listOwnedInboxAgentsForUser } = await import("./server");
    const result = await listOwnedInboxAgentsForUser({
      userId: "user-1",
      network: "Preprod",
      take: 10,
    });

    expect(inboxAgentReferenceCreateMock).not.toHaveBeenCalled();
    expect(result.Assets).toStrictEqual([]);
  });

  it("applies status, search, and cursor pagination after refresh", async () => {
    getPaymentNodeClientForUserMock.mockResolvedValue(null);
    getRegistryInboxByIdMock.mockImplementation(async ({ id }) =>
      makeInboxEntry({
        id,
        name: `Support ${id}`,
        state:
          id === "third" ? "RegistrationInitiated" : "RegistrationConfirmed",
      }),
    );
    const first = makeReference({
      id: "first",
      name: "Support alpha",
      agentSlug: "support-alpha",
      state: "RegistrationInitiated",
    });
    const second = makeReference({
      id: "second",
      name: "Support beta",
      agentSlug: "support-beta",
      state: "RegistrationInitiated",
    });
    const third = makeReference({
      id: "third",
      name: "Support gamma",
      agentSlug: "support-gamma",
    });
    inboxAgentReferenceFindManyMock.mockResolvedValue([first, second, third]);

    const { listOwnedInboxAgentsForUser } = await import("./server");
    const result = await listOwnedInboxAgentsForUser({
      userId: "user-1",
      network: "Preprod",
      filterStatus: "Registered",
      search: "support",
      cursor: "first",
      take: 1,
    });

    expect(inboxAgentReferenceFindManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        networkIdentifier: "Preprod",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(getRegistryInboxByIdMock).toHaveBeenCalledWith({
      id: "second",
      network: "Preprod",
    });
    expect(result.Assets.map((asset) => asset.id)).toStrictEqual(["second"]);
    expect(result.nextCursor).toBe("second");
  });
});

describe("getOwnedInboxAgentForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBaseUrlMock.mockReturnValue("https://payment.example.com/api/v1");
    getAdminApiKeyMock.mockReturnValue("admin-key");
    inboxAgentReferenceFindFirstMock.mockResolvedValue(null);
    createPaymentNodeClientMock.mockReturnValue({
      getPaymentSources: getPaymentSourcesMock,
      getRegistryInboxById: getRegistryInboxByIdMock,
    });
  });

  it("finds legacy wallet-owned inboxes without persisting them", async () => {
    const legacyEntry = makeInboxEntry({
      id: "legacy-1",
      RecipientWallet: {
        walletVkey: "legacy_recipient_vkey",
        walletAddress: "addr_test1recipient",
      },
    });
    const legacyGetRegistryInboxMock = vi.fn().mockResolvedValue({
      Assets: [legacyEntry],
    });
    getPaymentNodeClientForUserMock.mockResolvedValue({
      getApiKeyStatus: vi.fn().mockResolvedValue({
        WalletScopes: [{ hotWalletId: "managed-1" }],
      }),
      getRegistryInbox: legacyGetRegistryInboxMock,
    });
    getPaymentSourcesMock.mockResolvedValue({
      PaymentSources: [
        {
          id: "payment-source-1",
          network: "Preprod",
          smartContractAddress: "addr_test1contract",
          SellingWallets: [
            {
              id: "funding-1",
              walletVkey: "funding_vkey",
              walletAddress: "addr_test1funding",
              collectionAddress: null,
              note: "Funding wallet",
            },
            {
              id: "managed-1",
              walletVkey: "legacy_recipient_vkey",
              walletAddress: "addr_test1recipient",
              collectionAddress: null,
              note: "Legacy inbox recipient",
            },
          ],
          PurchasingWallets: [],
        },
      ],
    });

    const { getOwnedInboxAgentForUser } = await import("./server");
    const result = await getOwnedInboxAgentForUser({
      userId: "user-1",
      network: "Preprod",
      inboxAgentId: "legacy-1",
    });

    expect(inboxAgentReferenceFindFirstMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        networkIdentifier: "Preprod",
        paymentNodeId: "legacy-1",
      },
    });
    expect(result).toStrictEqual({
      source: "legacy-wallet",
      reference: null,
      entry: legacyEntry,
      executingWallet: {
        id: "funding-1",
        walletVkey: "funding_vkey",
        walletAddress: "addr_test1funding",
      },
      smartContractAddress: "addr_test1contract",
    });
    expect(inboxAgentReferenceCreateMock).not.toHaveBeenCalled();
    expect(inboxAgentReferenceUpdateMock).not.toHaveBeenCalled();
  });

  it("keeps DB-owned stale inboxes manageable when the payment-node row is missing", async () => {
    const reference = makeReference({
      id: "stale-1",
      state: "RegistrationInitiated",
    });
    inboxAgentReferenceFindFirstMock.mockResolvedValue(reference);
    getRegistryInboxByIdMock.mockResolvedValue(null);

    const { getOwnedInboxAgentForUser } = await import("./server");
    const result = await getOwnedInboxAgentForUser({
      userId: "user-1",
      network: "Preprod",
      inboxAgentId: "stale-1",
    });

    expect(getRegistryInboxByIdMock).toHaveBeenCalledWith({
      id: "stale-1",
      network: "Preprod",
    });
    expect(result).toMatchObject({
      source: "db",
      reference,
      entry: {
        id: "stale-1",
        state: "RegistrationInitiated",
      },
      executingWallet: {
        id: "funding-1",
        walletVkey: "funding_vkey",
        walletAddress: "addr_test1funding",
      },
      smartContractAddress: "addr_test1contract",
      remoteMissing: true,
    });
  });

  it("does not treat shared-wallet visibility as ownership", async () => {
    const sharedEntry = makeInboxEntry({
      id: "shared-1",
    });
    const legacyGetRegistryInboxMock = vi.fn().mockResolvedValue({
      Assets: [sharedEntry],
    });
    getPaymentNodeClientForUserMock.mockResolvedValue({
      getApiKeyStatus: vi.fn().mockResolvedValue({
        WalletScopes: [{ hotWalletId: "funding-1" }],
      }),
      getRegistryInbox: legacyGetRegistryInboxMock,
    });
    getPaymentSourcesMock.mockResolvedValue({
      PaymentSources: [
        {
          id: "payment-source-1",
          network: "Preprod",
          smartContractAddress: "addr_test1contract",
          SellingWallets: [
            {
              id: "funding-1",
              walletVkey: "funding_vkey",
              walletAddress: "addr_test1funding",
              collectionAddress: null,
              note: "Funding wallet",
            },
          ],
          PurchasingWallets: [],
        },
      ],
    });

    const { getOwnedInboxAgentForUser } = await import("./server");
    const result = await getOwnedInboxAgentForUser({
      userId: "user-1",
      network: "Preprod",
      inboxAgentId: "shared-1",
    });

    expect(result).toBeNull();
  });
});
