import { beforeEach, describe, expect, it, vi } from "vitest";

const createPaymentNodeClientMock = vi.fn();
const getPaymentNodeClientForUserMock = vi.fn();
const getBaseUrlMock = vi.fn();
const getAdminApiKeyMock = vi.fn();
const getPaymentSourceIdMock = vi.fn();
const getPaymentSourceIdEnvNameMock = vi.fn();
const getRegistrationFundingWalletsMock = vi.fn();
const agentCreateMock = vi.fn();
const agentFindFirstMock = vi.fn();
const agentFindUniqueMock = vi.fn();
const agentFindUniqueOrThrowMock = vi.fn();
const agentUpdateMock = vi.fn();
const agentReferenceCreateMock = vi.fn();
const agentReferenceUpdateMock = vi.fn();
const transactionMock = vi.fn();
const recordAgentActivityEventMock = vi.fn();
const ensureUserPaymentNodeKeyScopedToWalletsMock = vi.fn();

vi.mock("@masumi/database/client", () => ({
  default: {
    agent: {
      findFirst: agentFindFirstMock,
      findUnique: agentFindUniqueMock,
      findUniqueOrThrow: agentFindUniqueOrThrowMock,
      create: agentCreateMock,
      update: agentUpdateMock,
    },
    agentReference: {
      create: agentReferenceCreateMock,
      update: agentReferenceUpdateMock,
    },
    $transaction: transactionMock,
  },
}));

vi.mock("@/lib/activity-event", () => ({
  recordAgentActivityEvent: recordAgentActivityEventMock,
}));

vi.mock("@/lib/email/send-registration-complete", () => ({
  sendAgentRegistrationCompleteEmail: vi.fn(),
}));

vi.mock("@/lib/email/send-registration-failed", () => ({
  sendAgentRegistrationFailedEmail: vi.fn(),
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

vi.mock("./payment-node/config", () => ({
  paymentNodeConfig: {
    getBaseUrl: getBaseUrlMock,
    getAdminApiKey: getAdminApiKeyMock,
    getPaymentSourceId: getPaymentSourceIdMock,
    getPaymentSourceIdEnvName: getPaymentSourceIdEnvNameMock,
    getRegistrationFundingWallets: getRegistrationFundingWalletsMock,
  },
  isPaymentNodeConfigError: (error: unknown) =>
    error instanceof Error && error.name === "PaymentNodeConfigError",
}));

vi.mock("@/lib/payment-node/get-user-client", () => ({
  getPaymentNodeClientForUser: getPaymentNodeClientForUserMock,
}));

vi.mock("@/lib/payment-node/wallet-scopes", () => ({
  ensureUserPaymentNodeKeyScopedToWallets:
    ensureUserPaymentNodeKeyScopedToWalletsMock,
}));

vi.mock("@/lib/payment-node/tokens", () => ({
  USDM: {
    Preprod: { unit: "usdm_preprod", decimals: 6 },
    Mainnet: { unit: "usdm_mainnet", decimals: 6 },
  },
}));

const {
  completeOnChainRegistration,
  shouldCheckRecipientWalletForRegisteredAssets,
  startAgentRegistration,
} = await import("./agent-registration");
const { resolveRegistrationFundingWallet } =
  await import("./payment-node/registration-wallets");

describe("resolveRegistrationFundingWallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBaseUrlMock.mockReturnValue("https://payment.example.com/api/v1");
    getAdminApiKeyMock.mockReturnValue("admin-key");
    getPaymentSourceIdEnvNameMock.mockImplementation((network: string) =>
      network === "Mainnet"
        ? "PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET"
        : "PAYMENT_NODE_PAYMENT_SOURCE_ID_PREPROD",
    );
    getRegistrationFundingWalletsMock.mockReturnValue(["addr_test1funding"]);
    ensureUserPaymentNodeKeyScopedToWalletsMock.mockResolvedValue(undefined);
    agentCreateMock.mockResolvedValue({ id: "agent-1" });
    agentReferenceCreateMock.mockResolvedValue({});
    transactionMock.mockImplementation(async (callback) => callback({}));
  });

  it("selects randomly from all matched configured funding wallets", () => {
    getRegistrationFundingWalletsMock.mockReturnValue([
      "addr_test1missing",
      "addr_test1funding2",
      "addr_test1funding1",
    ]);
    vi.spyOn(Math, "random").mockReturnValue(0.75);

    const result = resolveRegistrationFundingWallet({
      network: "Preprod",
      paymentSourceId: "payment-source-1",
      sellingWallets: [
        {
          id: "wallet-1",
          walletVkey: "vkey-1",
          walletAddress: "addr_test1funding1",
          collectionAddress: null,
          note: "wallet 1",
        },
        {
          id: "wallet-2",
          walletVkey: "vkey-2",
          walletAddress: "addr_test1funding2",
          collectionAddress: null,
          note: "wallet 2",
        },
      ],
    });

    expect(result.error).toBeUndefined();
    expect(result.wallet?.id).toBe("wallet-1");
    expect(result.wallet?.walletVkey).toBe("vkey-1");
  });

  it("returns a clear error when no configured funding wallet matches", () => {
    getRegistrationFundingWalletsMock.mockReturnValue(["addr_test1missing"]);

    const result = resolveRegistrationFundingWallet({
      network: "Preprod",
      paymentSourceId: "payment-source-1",
      sellingWallets: [
        {
          id: "wallet-1",
          walletVkey: "vkey-1",
          walletAddress: "addr_test1funding1",
          collectionAddress: null,
          note: "wallet 1",
        },
      ],
    });

    expect(result.wallet).toBeNull();
    expect(result.error).toContain("payment-source-1");
    expect(result.error).toContain("Preprod");
  });
});

describe("shouldCheckRecipientWalletForRegisteredAssets", () => {
  it("returns false before any register attempt happened", () => {
    expect(shouldCheckRecipientWalletForRegisteredAssets()).toBe(false);
  });

  it("returns true after a prior register attempt timestamp exists", () => {
    expect(
      shouldCheckRecipientWalletForRegisteredAssets("2026-04-13T00:00:00.000Z"),
    ).toBe(true);
  });

  it("returns false for invalid timestamps", () => {
    expect(shouldCheckRecipientWalletForRegisteredAssets("not-a-date")).toBe(
      false,
    );
  });
});

describe("startAgentRegistration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBaseUrlMock.mockReturnValue("https://payment.example.com/api/v1");
    getAdminApiKeyMock.mockReturnValue("admin-key");
    getPaymentSourceIdEnvNameMock.mockImplementation((network: string) =>
      network === "Mainnet"
        ? "PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET"
        : "PAYMENT_NODE_PAYMENT_SOURCE_ID_PREPROD",
    );
    getRegistrationFundingWalletsMock.mockReturnValue(["addr_test1funding"]);
    ensureUserPaymentNodeKeyScopedToWalletsMock.mockResolvedValue(undefined);
    agentCreateMock.mockResolvedValue({ id: "agent-1" });
    agentReferenceCreateMock.mockResolvedValue({});
    transactionMock.mockImplementation(async (callback) => callback({}));
  });

  it("uses the Preprod payment source config and names the PREPROD env in mismatch errors", async () => {
    const generateWalletMock = vi.fn().mockResolvedValue({
      walletMnemonic: "selling mnemonic",
      walletAddress: "addr_test1selling",
      walletVkey: "selling-vkey",
    });
    const addWalletsToPaymentSourceMock = vi.fn().mockResolvedValue({
      id: "payment-source-preprod",
      network: "Mainnet",
      SellingWallets: [],
      PurchasingWallets: [],
    });

    getPaymentNodeClientForUserMock.mockResolvedValue({
      createApiKey: vi.fn(),
    });
    getPaymentSourceIdMock.mockReturnValue("payment-source-preprod");
    createPaymentNodeClientMock.mockReturnValue({
      generateWallet: generateWalletMock,
      addWalletsToPaymentSource: addWalletsToPaymentSourceMock,
    });

    const result = await startAgentRegistration(
      {
        user: {
          id: "user-1",
          name: "Taylor",
          email: "taylor@example.com",
        },
        activeOrganizationId: null,
        network: "Preprod",
      },
      {
        name: "Demo agent",
        description: "Test",
        extendedDescription: null,
        apiUrl: "https://agent.example.com",
        tags: ["demo"],
        icon: null,
        agentPricing: { pricingType: "Free" },
        exampleOutputs: [],
        capabilityName: "demo",
        capabilityVersion: "1.0.0",
      },
    );

    expect(getPaymentSourceIdMock).toHaveBeenCalledWith("Preprod");
    expect(addWalletsToPaymentSourceMock).toHaveBeenCalledWith({
      paymentSourceId: "payment-source-preprod",
      AddSellingWallets: [
        {
          walletMnemonic: "selling mnemonic",
          note: "Agent: Demo agent (selling)",
          collectionAddress: null,
        },
      ],
    });
    expect(result).toStrictEqual({
      success: false,
      error:
        "Configured payment source payment-source-preprod is on Mainnet, but agent registration is using Preprod. Update PAYMENT_NODE_PAYMENT_SOURCE_ID_PREPROD to a Preprod payment source.",
    });
  });

  it("allows Mainnet registration to proceed to network validation instead of short-circuiting", async () => {
    const generateWalletMock = vi.fn().mockResolvedValue({
      walletMnemonic: "selling mnemonic",
      walletAddress: "addr1selling",
      walletVkey: "selling-vkey-mainnet",
    });
    const addWalletsToPaymentSourceMock = vi.fn().mockResolvedValue({
      id: "payment-source-mainnet",
      network: "Preprod",
      SellingWallets: [],
      PurchasingWallets: [],
    });

    getPaymentNodeClientForUserMock.mockResolvedValue({
      createApiKey: vi.fn(),
    });
    getPaymentSourceIdMock.mockReturnValue("payment-source-mainnet");
    createPaymentNodeClientMock.mockReturnValue({
      generateWallet: generateWalletMock,
      addWalletsToPaymentSource: addWalletsToPaymentSourceMock,
    });

    const result = await startAgentRegistration(
      {
        user: {
          id: "user-1",
          name: "Taylor",
          email: "taylor@example.com",
        },
        activeOrganizationId: null,
        network: "Mainnet",
      },
      {
        name: "Mainnet agent",
        description: "Test",
        extendedDescription: null,
        apiUrl: "https://agent.example.com",
        tags: ["demo"],
        icon: null,
        agentPricing: { pricingType: "Free" },
        exampleOutputs: [],
        capabilityName: "demo",
        capabilityVersion: "1.0.0",
      },
    );

    expect(getPaymentSourceIdMock).toHaveBeenCalledWith("Mainnet");
    expect(addWalletsToPaymentSourceMock).toHaveBeenCalledWith({
      paymentSourceId: "payment-source-mainnet",
      AddSellingWallets: [
        {
          walletMnemonic: "selling mnemonic",
          note: "Agent: Mainnet agent (selling)",
          collectionAddress: null,
        },
      ],
    });
    expect(result).toStrictEqual({
      success: false,
      error:
        "Configured payment source payment-source-mainnet is on Preprod, but agent registration is using Mainnet. Update PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET to a Mainnet payment source.",
    });
  });

  it("keeps base URL config errors on the generic fallback path", async () => {
    getPaymentNodeClientForUserMock.mockResolvedValue({
      createApiKey: vi.fn(),
    });
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

    const result = await startAgentRegistration(
      {
        user: {
          id: "user-1",
          name: "Taylor",
          email: "taylor@example.com",
        },
        activeOrganizationId: null,
        network: "Mainnet",
      },
      {
        name: "Mainnet agent",
        description: "Test",
        extendedDescription: null,
        apiUrl: "https://agent.example.com",
        tags: ["demo"],
        icon: null,
        agentPricing: { pricingType: "Free" },
        exampleOutputs: [],
        capabilityName: "demo",
        capabilityVersion: "1.0.0",
      },
    );

    expect(result).toStrictEqual({
      success: false,
      error: "Something went wrong. Please try again later.",
    });
  });

  it("scopes the user key only to the generated selling wallet", async () => {
    const generateWalletMock = vi.fn().mockResolvedValue({
      walletMnemonic: "selling mnemonic",
      walletAddress: "addr_test1selling",
      walletVkey: "selling-vkey",
    });
    const addWalletsToPaymentSourceMock = vi.fn().mockResolvedValue({
      id: "payment-source-preprod",
      network: "Preprod",
      SellingWallets: [
        {
          id: "wallet-funding",
          walletVkey: "funding-vkey",
          walletAddress: "addr_test1funding",
          collectionAddress: null,
          note: "Funding",
        },
        {
          id: "wallet-new",
          walletVkey: "selling-vkey",
          walletAddress: "addr_test1selling",
          collectionAddress: null,
          note: "Agent: Demo agent (selling)",
        },
      ],
      PurchasingWallets: [],
      smartContractAddress: "addr_test1contract",
    });

    getPaymentNodeClientForUserMock.mockResolvedValue({
      createApiKey: vi.fn(),
    });
    getPaymentSourceIdMock.mockReturnValue("payment-source-preprod");
    createPaymentNodeClientMock.mockReturnValue({
      generateWallet: generateWalletMock,
      addWalletsToPaymentSource: addWalletsToPaymentSourceMock,
    });

    const result = await startAgentRegistration(
      {
        user: {
          id: "user-1",
          name: "Taylor",
          email: "taylor@example.com",
        },
        activeOrganizationId: null,
        network: "Preprod",
      },
      {
        name: "Demo agent",
        description: "Test",
        extendedDescription: null,
        apiUrl: "https://agent.example.com",
        tags: ["demo"],
        icon: null,
        agentPricing: { pricingType: "Free" },
        exampleOutputs: [],
        capabilityName: "demo",
        capabilityVersion: "1.0.0",
      },
    );

    expect(result).toStrictEqual({ success: true, agentId: "agent-1" });
    expect(ensureUserPaymentNodeKeyScopedToWalletsMock).toHaveBeenCalledWith({
      userId: "user-1",
      walletIds: ["wallet-new"],
    });
  });
});

describe("completeOnChainRegistration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBaseUrlMock.mockReturnValue("https://payment.example.com/api/v1");
    getAdminApiKeyMock.mockReturnValue("admin-key");
    getPaymentSourceIdEnvNameMock.mockImplementation((network: string) =>
      network === "Mainnet"
        ? "PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET"
        : "PAYMENT_NODE_PAYMENT_SOURCE_ID_PREPROD",
    );
  });

  it("submits agent registration with the admin key but only the generated selling wallet", async () => {
    const userRegisteredAgentsByWalletMock = vi
      .fn()
      .mockResolvedValue({ Assets: [] });
    const adminRegisterAgentMock = vi.fn().mockResolvedValue({
      id: "registry-entry-1",
      state: "RegistrationInitiated",
      agentIdentifier: null,
    });
    const txQueryRawMock = vi.fn().mockResolvedValue([{ externalId: null }]);
    const txAgentFindUniqueOrThrowMock = vi.fn().mockResolvedValue({
      id: "agent-1",
      registrationState: "RegistrationInitiated",
    });
    const agent = {
      id: "agent-1",
      userId: "user-1",
      name: "Demo agent",
      description: "Demo description",
      apiUrl: "https://agent.example.com",
      tags: ["demo"],
      registrationState: "RegistrationRequested",
      agentReference: {
        externalId: null,
        networkIdentifier: "Preprod",
        sellingWalletVkey: "selling-vkey",
        metadata: {
          sellingWalletAddress: "addr_test1selling",
          registrationPayload: {
            exampleOutputs: [],
            capabilityName: "demo",
            capabilityVersion: "1.0.0",
            authorName: "Taylor",
            authorEmail: "taylor@example.com",
            agentPricing: { pricingType: "Free" },
          },
        },
      },
    };

    agentFindFirstMock.mockResolvedValue(agent);
    getPaymentNodeClientForUserMock.mockResolvedValue({
      getRegisteredAgentsByWallet: userRegisteredAgentsByWalletMock,
    });
    createPaymentNodeClientMock.mockReturnValue({
      registerAgent: adminRegisterAgentMock,
    });
    transactionMock.mockImplementation(async (callback) =>
      callback({
        $queryRaw: txQueryRawMock,
        agent: {
          findUniqueOrThrow: txAgentFindUniqueOrThrowMock,
          update: agentUpdateMock,
        },
        agentReference: {
          update: agentReferenceUpdateMock,
        },
      }),
    );

    const result = await completeOnChainRegistration("agent-1", "user-1");

    expect(result).toStrictEqual({ status: "pending" });
    expect(createPaymentNodeClientMock).toHaveBeenCalledWith(
      "https://payment.example.com/api/v1",
      "admin-key",
    );
    expect(userRegisteredAgentsByWalletMock).not.toHaveBeenCalled();
    expect(adminRegisterAgentMock).toHaveBeenCalledWith({
      network: "Preprod",
      sellingWalletVkey: "selling-vkey",
      recipientWalletAddress: "addr_test1selling",
      name: "Demo agent",
      apiBaseUrl: "https://agent.example.com",
      description: "Demo description",
      Tags: ["demo"],
      ExampleOutputs: [],
      Capability: {
        name: "demo",
        version: "1.0.0",
      },
      Author: {
        name: "Taylor",
        contactEmail: "taylor@example.com",
        contactOther: undefined,
        organization: undefined,
      },
      AgentPricing: { pricingType: "Free" },
    });
  });
});
