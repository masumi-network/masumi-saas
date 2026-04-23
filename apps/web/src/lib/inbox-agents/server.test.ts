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
const getRegistryInboxMock = vi.fn();
const getRegistryInboxByIdMock = vi.fn();
const getPaymentNodeClientForUserMock = vi.fn();
const inboxAgentReferenceCreateMock = vi.fn();
const inboxAgentReferenceDeleteMock = vi.fn();
const inboxAgentReferenceFindFirstMock = vi.fn();
const inboxAgentReferenceFindManyMock = vi.fn();
const inboxAgentReferenceFindUniqueMock = vi.fn();
const inboxAgentReferenceUpdateMock = vi.fn();
const prismaTransactionMock = vi.fn();
const prismaExecuteRawMock = vi.fn();

vi.mock("@masumi/database/client", () => ({
  default: {
    $transaction: prismaTransactionMock,
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
    prismaTransactionMock.mockImplementation(async (callback) =>
      callback({ $executeRaw: prismaExecuteRawMock }),
    );
    prismaExecuteRawMock.mockResolvedValue(undefined);
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
      getRegistryInbox: getRegistryInboxMock,
      getRegistryInboxById: getRegistryInboxByIdMock,
    });
  });

  it("uses the configured registration funding wallet as the inbox executing wallet", async () => {
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

    expect(resolveRegistrationFundingWalletMock).toHaveBeenCalledWith({
      network: "Preprod",
      paymentSourceId: "payment-source-1",
      sellingWallets: [fundingWallet],
    });
    expect(generateWalletMock).not.toHaveBeenCalled();
    expect(addWalletsToPaymentSourceMock).not.toHaveBeenCalled();
    expect(getPaymentSourcesMock).toHaveBeenCalledWith({
      take: 100,
      cursorId: undefined,
    });
    expect(result).toStrictEqual({
      success: true,
      executingWallet: fundingWallet,
      paymentSourceId: "payment-source-1",
      smartContractAddress: "addr_test1contract",
    });
  });

  it("uses the Mainnet payment source and Mainnet funding wallet for Mainnet requests", async () => {
    const fundingWallet = {
      id: "funding-mainnet",
      walletVkey: "funding_vkey_mainnet",
      walletAddress: "addr1funding",
      collectionAddress: null,
      note: "Mainnet funding wallet",
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
    expect(resolveRegistrationFundingWalletMock).toHaveBeenCalledWith({
      network: "Mainnet",
      paymentSourceId: "payment-source-mainnet",
      sellingWallets: [fundingWallet],
    });
    expect(generateWalletMock).not.toHaveBeenCalled();
    expect(addWalletsToPaymentSourceMock).not.toHaveBeenCalled();
    expect(result).toStrictEqual({
      success: true,
      executingWallet: fundingWallet,
      paymentSourceId: "payment-source-mainnet",
      smartContractAddress: "addr1contract",
    });
  });

  it("returns the funding-wallet resolver error when no configured wallet matches", async () => {
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
    resolveRegistrationFundingWalletMock.mockReturnValue({
      wallet: null,
      error:
        "None of the configured registration funding wallets matched a managed selling wallet on payment source payment-source-mainnet for Mainnet.",
    });

    const { prepareManagedInboxRegistration } = await import("./server");
    const result = await prepareManagedInboxRegistration({
      name: "Mainnet inbox",
      network: "Mainnet",
    });

    expect(result).toStrictEqual({
      success: false,
      error:
        "None of the configured registration funding wallets matched a managed selling wallet on payment source payment-source-mainnet for Mainnet.",
    });
    expect(generateWalletMock).not.toHaveBeenCalled();
    expect(addWalletsToPaymentSourceMock).not.toHaveBeenCalled();
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

describe("withInboxAgentSlugRegistrationLock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaTransactionMock.mockImplementation(async (callback) =>
      callback({ $executeRaw: prismaExecuteRawMock }),
    );
    prismaExecuteRawMock.mockResolvedValue(undefined);
  });

  it("holds a postgres advisory lock while running the registration critical section", async () => {
    const runMock = vi.fn().mockResolvedValue("ok");

    const { withInboxAgentSlugRegistrationLock } = await import("./server");
    const result = await withInboxAgentSlugRegistrationLock({
      network: "Preprod",
      slug: "support-inbox",
      run: runMock,
    });

    expect(prismaTransactionMock).toHaveBeenCalledTimes(1);
    expect(prismaExecuteRawMock).toHaveBeenCalledTimes(1);
    expect(runMock).toHaveBeenCalledTimes(1);
    expect(result).toBe("ok");
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
    getRegistryInboxMock.mockResolvedValue({ Assets: [] });
    inboxAgentReferenceFindFirstMock.mockResolvedValue(null);
    inboxAgentReferenceFindUniqueMock.mockResolvedValue(null);
    inboxAgentReferenceCreateMock.mockImplementation(async ({ data }) => ({
      id: `ref-${data.paymentNodeId}`,
      createdAt: new Date("2026-04-13T10:00:00.000Z"),
      updatedAt: new Date("2026-04-13T10:01:00.000Z"),
      ...data,
    }));
    createPaymentNodeClientMock.mockReturnValue({
      getPaymentSources: getPaymentSourcesMock,
      getRegistryInbox: getRegistryInboxMock,
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
    expect(createPaymentNodeClientMock).not.toHaveBeenCalled();
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
    const first = makeReference({
      id: "first",
      name: "Support alpha",
      agentSlug: "support-alpha",
      state: "RegistrationInitiated",
      createdAt: "2026-04-13T10:05:00.000Z",
    });
    const second = makeReference({
      id: "second",
      name: "Support beta",
      agentSlug: "support-beta",
      state: "RegistrationConfirmed",
      createdAt: "2026-04-13T10:04:00.000Z",
    });
    const third = makeReference({
      id: "third",
      name: "Support gamma",
      agentSlug: "support-gamma",
      createdAt: "2026-04-13T10:03:00.000Z",
    });
    inboxAgentReferenceFindFirstMock.mockResolvedValue(first);
    inboxAgentReferenceFindManyMock.mockResolvedValue([second, third]);

    const { listOwnedInboxAgentsForUser } = await import("./server");
    const result = await listOwnedInboxAgentsForUser({
      userId: "user-1",
      network: "Preprod",
      filterStatus: "Registered",
      search: "support",
      cursor: "first",
      take: 1,
    });

    expect(inboxAgentReferenceFindFirstMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        networkIdentifier: "Preprod",
        paymentNodeId: "first",
      },
    });
    expect(inboxAgentReferenceFindManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        networkIdentifier: "Preprod",
        AND: expect.arrayContaining([
          {
            state: {
              in: expect.arrayContaining(["RegistrationConfirmed"]),
            },
          },
          expect.objectContaining({
            OR: expect.arrayContaining([
              { name: { contains: "support", mode: "insensitive" } },
            ]),
          }),
          {
            OR: [
              { createdAt: { lt: first.createdAt } },
              {
                createdAt: first.createdAt,
                id: { lt: first.id },
              },
            ],
          },
        ]),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 1,
    });
    expect(getRegistryInboxByIdMock).toHaveBeenCalledWith({
      id: "first",
      network: "Preprod",
    });
    expect(getRegistryInboxByIdMock).toHaveBeenCalledTimes(1);
    expect(createPaymentNodeClientMock).toHaveBeenCalledWith(
      "https://payment.example.com/api/v1",
      "admin-key",
    );
    expect(getPaymentNodeClientForUserMock).not.toHaveBeenCalled();
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
      expect(createPaymentNodeClientMock).toHaveBeenCalledWith(
        "https://payment.example.com/api/v1",
        "admin-key",
      );
      expect(getPaymentNodeClientForUserMock).not.toHaveBeenCalled();
      expect(inboxAgentReferenceCreateMock).toHaveBeenCalledWith({
        data: expect.objectContaining({ paymentNodeId: "write-fails" }),
      });
      expect(warnSpy).toHaveBeenCalledTimes(2);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("only refreshes the requested DB page instead of every owned reference", async () => {
    const references = Array.from({ length: 150 }, (_, index) =>
      makeReference({
        id: `agent-${index.toString().padStart(3, "0")}`,
        name: `Agent ${index}`,
        agentSlug: `agent-${index}`,
        state: "RegistrationInitiated",
        createdAt: new Date(Date.UTC(2026, 3, 13, 10, 0, index)).toISOString(),
      }),
    );
    inboxAgentReferenceFindManyMock.mockResolvedValue(references.slice(0, 1));
    getRegistryInboxByIdMock.mockImplementation(async ({ id }) =>
      makeInboxEntry({
        id,
        name: `Remote ${id}`,
        agentSlug: id,
        state: "RegistrationConfirmed",
      }),
    );

    const { listOwnedInboxAgentsForUser } = await import("./server");
    const result = await listOwnedInboxAgentsForUser({
      userId: "user-1",
      network: "Preprod",
      take: 1,
    });

    expect(inboxAgentReferenceFindManyMock).toHaveBeenCalledTimes(1);
    expect(inboxAgentReferenceFindManyMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        networkIdentifier: "Preprod",
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 1,
    });
    expect(getRegistryInboxByIdMock).toHaveBeenCalledTimes(1);
    expect(createPaymentNodeClientMock).toHaveBeenCalledWith(
      "https://payment.example.com/api/v1",
      "admin-key",
    );
    expect(getPaymentNodeClientForUserMock).not.toHaveBeenCalled();
    expect(result.Assets).toHaveLength(1);
    expect(result.nextCursor).toBe(result.Assets[0]?.id);
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
    inboxAgentReferenceFindFirstMock.mockResolvedValue(cursorEntry);
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
    expect(inboxAgentReferenceFindManyMock).not.toHaveBeenCalled();
    expect(createPaymentNodeClientMock).toHaveBeenCalledWith(
      "https://payment.example.com/api/v1",
      "admin-key",
    );
    expect(getPaymentNodeClientForUserMock).not.toHaveBeenCalled();
  });
});

describe("findInboxAgentSlugConflict", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inboxAgentReferenceFindManyMock.mockResolvedValue([]);
    inboxAgentReferenceFindUniqueMock.mockResolvedValue(null);
    inboxAgentReferenceUpdateMock.mockImplementation(
      async ({ where, data }) => ({
        id: where.id,
        userId: "user-1",
        createdAt: new Date("2026-04-13T10:00:00.000Z"),
        updatedAt: new Date("2026-04-13T10:01:00.000Z"),
        ...data,
      }),
    );
    getRegistryInboxByIdMock.mockResolvedValue(null);
    getRegistryInboxMock.mockResolvedValue({ Assets: [] });
  });

  it("returns a DB conflict for a non-deregistered slug reference", async () => {
    inboxAgentReferenceFindManyMock.mockResolvedValue([
      makeReference({
        id: "existing-id",
        paymentNodeId: "existing-id",
        agentSlug: "support-inbox",
        state: "RegistrationConfirmed",
        agentIdentifier: "policy.existing",
      }),
    ]);

    const { findInboxAgentSlugConflict } = await import("./server");
    const result = await findInboxAgentSlugConflict({
      network: "Preprod",
      slug: "support-inbox",
      client: {
        getRegistryInboxById: getRegistryInboxByIdMock,
        getRegistryInbox: getRegistryInboxMock,
      } as never,
    });

    expect(result).toStrictEqual({
      source: "db",
      state: "RegistrationConfirmed",
      paymentNodeId: "existing-id",
      agentIdentifier: "policy.existing",
    });
    expect(getRegistryInboxByIdMock).not.toHaveBeenCalled();
    expect(getRegistryInboxMock).not.toHaveBeenCalled();
  });

  it("refreshes pending DB references and updates agent identifiers before deciding", async () => {
    const pendingReference = makeReference({
      id: "pending-id",
      paymentNodeId: "pending-id",
      userId: "owner-1",
      agentSlug: "support-inbox",
      state: "RegistrationRequested",
      agentIdentifier: null,
    });
    inboxAgentReferenceFindManyMock.mockResolvedValue([pendingReference]);
    inboxAgentReferenceFindUniqueMock.mockResolvedValue(pendingReference);
    getRegistryInboxByIdMock.mockResolvedValue(
      makeInboxEntry({
        id: "pending-id",
        agentSlug: "support-inbox",
        state: "RegistrationConfirmed",
        agentIdentifier: "policy.updated",
      }),
    );

    const { findInboxAgentSlugConflict } = await import("./server");
    const result = await findInboxAgentSlugConflict({
      network: "Preprod",
      slug: "support-inbox",
      client: {
        getRegistryInboxById: getRegistryInboxByIdMock,
        getRegistryInbox: getRegistryInboxMock,
      } as never,
    });

    expect(getRegistryInboxByIdMock).toHaveBeenCalledWith({
      id: "pending-id",
      network: "Preprod",
    });
    expect(inboxAgentReferenceUpdateMock).toHaveBeenCalledWith({
      where: { id: "pending-id" },
      data: expect.objectContaining({
        paymentNodeId: "pending-id",
        agentSlug: "support-inbox",
        state: "RegistrationConfirmed",
        agentIdentifier: "policy.updated",
      }),
    });
    expect(result).toStrictEqual({
      source: "db",
      state: "RegistrationConfirmed",
      paymentNodeId: "pending-id",
      agentIdentifier: "policy.updated",
    });
  });

  it("allows re-registration after a deregistered DB reference when the registry is clear", async () => {
    inboxAgentReferenceFindManyMock.mockResolvedValue([
      makeReference({
        id: "old-id",
        paymentNodeId: "old-id",
        agentSlug: "support-inbox",
        state: "DeregistrationConfirmed",
        agentIdentifier: "policy.old",
      }),
    ]);

    const { findInboxAgentSlugConflict } = await import("./server");
    const result = await findInboxAgentSlugConflict({
      network: "Preprod",
      slug: "support-inbox",
      client: {
        getRegistryInboxById: getRegistryInboxByIdMock,
        getRegistryInbox: getRegistryInboxMock,
      } as never,
    });

    expect(getRegistryInboxMock).toHaveBeenCalledWith({
      network: "Preprod",
      cursorId: undefined,
      limit: 100,
      searchQuery: "support-inbox",
    });
    expect(result).toBeNull();
  });

  it("returns a registry conflict when the remote slug exists and is not deregistered", async () => {
    getRegistryInboxMock.mockResolvedValue({
      Assets: [
        makeInboxEntry({
          id: "remote-id",
          agentSlug: "support-inbox",
          state: "RegistrationConfirmed",
          agentIdentifier: "policy.remote",
        }),
      ],
    });

    const { findInboxAgentSlugConflict } = await import("./server");
    const result = await findInboxAgentSlugConflict({
      network: "Preprod",
      slug: "support-inbox",
      client: {
        getRegistryInboxById: getRegistryInboxByIdMock,
        getRegistryInbox: getRegistryInboxMock,
      } as never,
    });

    expect(result).toStrictEqual({
      source: "registry",
      state: "RegistrationConfirmed",
      paymentNodeId: "remote-id",
      agentIdentifier: "policy.remote",
    });
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
      getRegistryInbox: getRegistryInboxMock,
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
    expect(createPaymentNodeClientMock).not.toHaveBeenCalled();
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
    expect(createPaymentNodeClientMock).toHaveBeenCalledWith(
      "https://payment.example.com/api/v1",
      "admin-key",
    );
    expect(getPaymentNodeClientForUserMock).not.toHaveBeenCalled();
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

  it("filters registered owned inbox references by agent identifier in the DB", async () => {
    const reference = makeReference({
      id: "registered-reference",
      state: "RegistrationConfirmed",
    });
    inboxAgentReferenceFindFirstMock.mockResolvedValue(reference);

    const { getRegisteredOwnedInboxAgentReferenceByAgentIdentifier } =
      await import("./server");
    const result = await getRegisteredOwnedInboxAgentReferenceByAgentIdentifier(
      {
        userId: "user-1",
        network: "Preprod",
        agentIdentifier: "policy.asset",
      },
    );

    expect(inboxAgentReferenceFindFirstMock).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        networkIdentifier: "Preprod",
        agentIdentifier: "policy.asset",
        state: "RegistrationConfirmed",
      },
    });
    expect(result).toBe(reference);
    expect(createPaymentNodeClientMock).not.toHaveBeenCalled();
    expect(getPaymentNodeClientForUserMock).not.toHaveBeenCalled();
  });
});
