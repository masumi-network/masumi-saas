import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createPaymentNodeClientMock = vi.fn();
const getBaseUrlMock = vi.fn();
const getAdminApiKeyMock = vi.fn();
const getPaymentSourceIdMock = vi.fn();
const getPaymentSourceIdEnvNameMock = vi.fn();
const isWalletAddressCompatibleWithNetworkMock = vi.fn();

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

  it("creates a managed inbox wallet and returns the new wallet identity", async () => {
    const generatedWallet = {
      walletMnemonic: "new inbox mnemonic",
      walletVkey: "managed_vkey",
      walletAddress: "addr_test1managed",
    };
    const managedWallet = {
      id: "managed-1",
      walletVkey: "managed_vkey",
      walletAddress: "addr_test1managed",
      collectionAddress: null,
      note: "Inbox agent: Support inbox (selling)",
    };
    getPaymentSourcesMock.mockResolvedValue({
      PaymentSources: [
        {
          id: "payment-source-1",
          network: "Preprod",
          smartContractAddress: "addr_test1contract",
          SellingWallets: [],
          PurchasingWallets: [],
        },
      ],
    });
    generateWalletMock.mockResolvedValue(generatedWallet);
    addWalletsToPaymentSourceMock.mockResolvedValue({
      id: "payment-source-1",
      network: "Preprod",
      smartContractAddress: "addr_test1contract",
      SellingWallets: [managedWallet],
      PurchasingWallets: [],
    });

    const { prepareManagedInboxRegistration } = await import("./server");
    const result = await prepareManagedInboxRegistration({
      name: "Support inbox",
      network: "Preprod",
    });

    expect(generateWalletMock).toHaveBeenCalledWith("Preprod");
    expect(addWalletsToPaymentSourceMock).toHaveBeenCalledWith({
      paymentSourceId: "payment-source-1",
      AddSellingWallets: [
        {
          walletMnemonic: "new inbox mnemonic",
          note: "Inbox agent: Support inbox (selling)",
          collectionAddress: null,
        },
      ],
    });
    expect(getPaymentSourcesMock).toHaveBeenCalledWith({
      take: 100,
      cursorId: undefined,
    });
    expect(result).toStrictEqual({
      success: true,
      executingWallet: managedWallet,
      paymentSourceId: "payment-source-1",
      smartContractAddress: "addr_test1contract",
    });
  });

  it("uses the Mainnet payment source configured for Mainnet requests", async () => {
    const generatedWallet = {
      walletMnemonic: "new mainnet inbox mnemonic",
      walletVkey: "managed_vkey_mainnet",
      walletAddress: "addr1managed",
    };
    const managedWallet = {
      id: "managed-mainnet",
      walletVkey: "managed_vkey_mainnet",
      walletAddress: "addr1managed",
      collectionAddress: null,
      note: "Inbox agent: Mainnet inbox (selling)",
    };
    getPaymentSourcesMock.mockResolvedValue({
      PaymentSources: [
        {
          id: "payment-source-mainnet",
          network: "Mainnet",
          smartContractAddress: "addr1contract",
          SellingWallets: [],
          PurchasingWallets: [],
        },
      ],
    });
    generateWalletMock.mockResolvedValue(generatedWallet);
    addWalletsToPaymentSourceMock.mockResolvedValue({
      id: "payment-source-mainnet",
      network: "Mainnet",
      smartContractAddress: "addr1contract",
      SellingWallets: [managedWallet],
      PurchasingWallets: [],
    });

    const { prepareManagedInboxRegistration } = await import("./server");
    const result = await prepareManagedInboxRegistration({
      name: "Mainnet inbox",
      network: "Mainnet",
    });

    expect(getPaymentSourceIdMock).toHaveBeenCalledWith("Mainnet");
    expect(generateWalletMock).toHaveBeenCalledWith("Mainnet");
    expect(result).toStrictEqual({
      success: true,
      executingWallet: managedWallet,
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

  it("returns an empty list without payment-node lookup when no DB ownership references exist", async () => {
    inboxAgentReferenceFindManyMock.mockResolvedValue([]);

    const { listOwnedInboxAgentsForUser } = await import("./server");
    const result = await listOwnedInboxAgentsForUser({
      userId: "user-1",
      network: "Preprod",
      take: 10,
    });

    expect(getPaymentNodeClientForUserMock).not.toHaveBeenCalled();
    expect(inboxAgentReferenceCreateMock).not.toHaveBeenCalled();
    expect(inboxAgentReferenceUpdateMock).not.toHaveBeenCalled();
    expect(result.Assets).toStrictEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it("applies status, search, and cursor pagination after refresh", async () => {
    getRegistryInboxByIdMock.mockImplementation(async ({ id }) =>
      makeInboxEntry({
        id,
        name: `Support ${id}`,
        state:
          id === "third" ? "RegistrationInitiated" : "RegistrationConfirmed",
      }),
    );
    getPaymentNodeClientForUserMock.mockResolvedValue({
      getRegistryInboxById: getRegistryInboxByIdMock,
    });
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

  it("falls back to stored references when individual refreshes fail", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      getRegistryInboxByIdMock.mockImplementation(async ({ id }) => {
        if (id === "remote-fails") {
          throw new Error("payment node unavailable");
        }

        return makeInboxEntry({
          id,
          name: `Remote ${id}`,
          state: "RegistrationConfirmed",
          createdAt:
            id === "ok"
              ? "2026-04-13T10:04:00.000Z"
              : "2026-04-13T10:01:00.000Z",
        });
      });
      inboxAgentReferenceCreateMock.mockImplementation(async ({ data }) => {
        if (data.paymentNodeId === "write-fails") {
          throw new Error("database unavailable");
        }

        return {
          id: `ref-${data.paymentNodeId}`,
          createdAt: new Date("2026-04-13T10:00:00.000Z"),
          updatedAt: new Date("2026-04-13T10:01:00.000Z"),
          ...data,
        };
      });
      getPaymentNodeClientForUserMock.mockResolvedValue({
        getRegistryInboxById: getRegistryInboxByIdMock,
      });
      const remoteFails = makeReference({
        id: "remote-fails",
        name: "Local remote failure",
        agentSlug: "local-remote-failure",
        state: "RegistrationInitiated",
        createdAt: "2026-04-13T10:03:00.000Z",
      });
      const writeFails = makeReference({
        id: "write-fails",
        name: "Local write failure",
        agentSlug: "local-write-failure",
        state: "RegistrationInitiated",
        createdAt: "2026-04-13T10:02:00.000Z",
      });
      const ok = makeReference({
        id: "ok",
        name: "Local ok",
        agentSlug: "local-ok",
        state: "RegistrationInitiated",
        createdAt: "2026-04-13T10:00:00.000Z",
      });
      inboxAgentReferenceFindManyMock.mockResolvedValue([
        remoteFails,
        writeFails,
        ok,
      ]);

      const { listOwnedInboxAgentsForUser } = await import("./server");
      const result = await listOwnedInboxAgentsForUser({
        userId: "user-1",
        network: "Preprod",
        take: 10,
      });

      expect(
        result.Assets.map(({ id, name, state }) => ({ id, name, state })),
      ).toStrictEqual([
        {
          id: "ok",
          name: "Remote ok",
          state: "RegistrationConfirmed",
        },
        {
          id: "remote-fails",
          name: "Local remote failure",
          state: "RegistrationInitiated",
        },
        {
          id: "write-fails",
          name: "Local write failure",
          state: "RegistrationInitiated",
        },
      ]);
      expect(result.nextCursor).toBeNull();
      expect(getRegistryInboxByIdMock).toHaveBeenCalledTimes(3);
      expect(inboxAgentReferenceCreateMock).toHaveBeenCalledWith({
        data: expect.objectContaining({ paymentNodeId: "write-fails" }),
      });
      expect(warnSpy).toHaveBeenCalledTimes(2);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("rejects stale cursors when refresh moves the cursor entry out of the filtered list", async () => {
    getRegistryInboxByIdMock.mockImplementation(async ({ id }) =>
      makeInboxEntry({
        id,
        state:
          id === "cursor-entry"
            ? "RegistrationConfirmed"
            : "RegistrationInitiated",
      }),
    );
    getPaymentNodeClientForUserMock.mockResolvedValue({
      getRegistryInboxById: getRegistryInboxByIdMock,
    });
    const cursorEntry = makeReference({
      id: "cursor-entry",
      name: "Support cursor",
      agentSlug: "support-cursor",
      state: "RegistrationInitiated",
    });
    const nextEntry = makeReference({
      id: "next-entry",
      name: "Support next",
      agentSlug: "support-next",
      state: "RegistrationInitiated",
    });
    inboxAgentReferenceFindManyMock.mockResolvedValue([cursorEntry, nextEntry]);

    const { listOwnedInboxAgentsForUser, StaleInboxAgentCursorError } =
      await import("./server");
    await expect(
      listOwnedInboxAgentsForUser({
        userId: "user-1",
        network: "Preprod",
        filterStatus: "Pending",
        cursor: "cursor-entry",
        take: 1,
      }),
    ).rejects.toBeInstanceOf(StaleInboxAgentCursorError);
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

  it("returns null without payment-node lookup when no DB ownership reference exists", async () => {
    const { getOwnedInboxAgentForUser } = await import("./server");
    const result = await getOwnedInboxAgentForUser({
      userId: "user-1",
      network: "Preprod",
      inboxAgentId: "missing-1",
    });

    expect(inboxAgentReferenceFindFirstMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        networkIdentifier: "Preprod",
        paymentNodeId: "missing-1",
      },
    });
    expect(getPaymentNodeClientForUserMock).not.toHaveBeenCalled();
    expect(result).toBeNull();
    expect(inboxAgentReferenceCreateMock).not.toHaveBeenCalled();
    expect(inboxAgentReferenceUpdateMock).not.toHaveBeenCalled();
  });

  it("keeps DB-owned references local when the user lookup misses", async () => {
    const reference = makeReference({
      id: "stale-1",
      state: "RegistrationInitiated",
    });
    inboxAgentReferenceFindFirstMock.mockResolvedValue(reference);
    getRegistryInboxByIdMock.mockResolvedValue(null);
    getPaymentNodeClientForUserMock.mockResolvedValue({
      getRegistryInboxById: getRegistryInboxByIdMock,
    });

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
    });
  });

  it("returns null by agent identifier without payment-node lookup when no DB ownership reference exists", async () => {
    const { getOwnedInboxAgentByAgentIdentifierForUser } =
      await import("./server");
    const result = await getOwnedInboxAgentByAgentIdentifierForUser({
      userId: "user-1",
      network: "Preprod",
      agentIdentifier: "policy.asset",
    });

    expect(inboxAgentReferenceFindFirstMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        networkIdentifier: "Preprod",
        agentIdentifier: "policy.asset",
      },
    });
    expect(getPaymentNodeClientForUserMock).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
