import { beforeEach, describe, expect, it, vi } from "vitest";

const agentReferenceFindManyMock = vi.fn();
const inboxAgentReferenceFindManyMock = vi.fn();
const getPaymentNodeApiKeyTokenForUserMock = vi.fn();
const createPaymentNodeClientMock = vi.fn();
const getBaseUrlMock = vi.fn();
const getAdminApiKeyMock = vi.fn();
const getRegistrationFundingWalletsMock = vi.fn();

vi.mock("@masumi/database/client", () => ({
  default: {
    agentReference: {
      findMany: agentReferenceFindManyMock,
    },
    inboxAgentReference: {
      findMany: inboxAgentReferenceFindManyMock,
    },
  },
}));

vi.mock("@/lib/payment-node", () => ({
  createPaymentNodeClient: createPaymentNodeClientMock,
  paymentNodeConfig: {
    getBaseUrl: getBaseUrlMock,
    getAdminApiKey: getAdminApiKeyMock,
    getRegistrationFundingWallets: getRegistrationFundingWalletsMock,
  },
}));

vi.mock("@/lib/payment-node/get-user-client", () => ({
  getPaymentNodeApiKeyTokenForUser: getPaymentNodeApiKeyTokenForUserMock,
}));

describe("ensureUserPaymentNodeKeyScopedToWallets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBaseUrlMock.mockReturnValue("https://payment.example.com/api/v1");
    getAdminApiKeyMock.mockReturnValue("admin-key");
    getRegistrationFundingWalletsMock.mockReturnValue([]);
    getPaymentNodeApiKeyTokenForUserMock.mockResolvedValue("user-key");
  });

  it("enables wallet scope while preserving current payment-node and agent wallet IDs", async () => {
    const getApiKeyStatusMock = vi.fn().mockResolvedValue({
      id: "api-key-1",
      token: "user-key",
      permission: "ReadAndPay",
      canRead: true,
      canPay: true,
      canAdmin: false,
      usageLimited: false,
      NetworkLimit: ["Preprod", "Mainnet"],
      RemainingUsageCredits: [],
      status: "Active",
      walletScopeEnabled: false,
      WalletScopes: [
        { hotWalletId: "wallet-existing" },
        { hotWalletId: "wallet-admin-funding" },
      ],
    });
    const updateApiKeyMock = vi.fn().mockResolvedValue({});
    createPaymentNodeClientMock
      .mockReturnValueOnce({
        getApiKeyStatus: getApiKeyStatusMock,
      })
      .mockReturnValueOnce({
        updateApiKey: updateApiKeyMock,
      });
    agentReferenceFindManyMock.mockResolvedValue([
      { sellingWalletId: "wallet-known" },
      { sellingWalletId: "wallet-existing" },
    ]);
    inboxAgentReferenceFindManyMock.mockResolvedValue([
      { executingWalletId: "wallet-inbox" },
    ]);

    const { ensureUserPaymentNodeKeyScopedToWallets } =
      await import("./wallet-scopes");

    await ensureUserPaymentNodeKeyScopedToWallets({
      userId: "user-1",
      walletIds: ["wallet-new", "wallet-new"],
    });

    expect(updateApiKeyMock).toHaveBeenCalledWith({
      id: "api-key-1",
      walletScopeEnabled: true,
      WalletScopeHotWalletIds: [
        "wallet-existing",
        "wallet-admin-funding",
        "wallet-known",
        "wallet-new",
      ],
    });
    expect(inboxAgentReferenceFindManyMock).not.toHaveBeenCalled();
  });

  it("filters configured registration funding wallets out of wallet scopes", async () => {
    getRegistrationFundingWalletsMock.mockImplementation((network: string) =>
      network === "Preprod" ? ["addr_test1funding"] : [],
    );
    const getApiKeyStatusMock = vi.fn().mockResolvedValue({
      id: "api-key-1",
      token: "user-key",
      permission: "ReadAndPay",
      canRead: true,
      canPay: true,
      canAdmin: false,
      usageLimited: false,
      NetworkLimit: ["Preprod"],
      RemainingUsageCredits: [],
      status: "Active",
      walletScopeEnabled: true,
      WalletScopes: [
        { hotWalletId: "wallet-existing" },
        { hotWalletId: "wallet-funding" },
      ],
    });
    const getPaymentSourcesMock = vi.fn().mockResolvedValue({
      PaymentSources: [
        {
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
          ],
          PurchasingWallets: [],
        },
      ],
    });
    const updateApiKeyMock = vi.fn().mockResolvedValue({});
    createPaymentNodeClientMock
      .mockReturnValueOnce({
        getApiKeyStatus: getApiKeyStatusMock,
      })
      .mockReturnValueOnce({
        getPaymentSources: getPaymentSourcesMock,
        updateApiKey: updateApiKeyMock,
      });
    agentReferenceFindManyMock.mockResolvedValue([
      { sellingWalletId: "wallet-known" },
      { sellingWalletId: "wallet-funding" },
    ]);

    const { ensureUserPaymentNodeKeyScopedToWallets } =
      await import("./wallet-scopes");

    await ensureUserPaymentNodeKeyScopedToWallets({
      userId: "user-1",
      walletIds: ["wallet-new", "wallet-funding"],
    });

    expect(updateApiKeyMock).toHaveBeenCalledWith({
      id: "api-key-1",
      walletScopeEnabled: true,
      WalletScopeHotWalletIds: [
        "wallet-existing",
        "wallet-known",
        "wallet-new",
      ],
    });
    expect(inboxAgentReferenceFindManyMock).not.toHaveBeenCalled();
  });

  it("does nothing when the key is already scoped to all requested wallets", async () => {
    const getApiKeyStatusMock = vi.fn().mockResolvedValue({
      id: "api-key-1",
      token: "user-key",
      permission: "ReadAndPay",
      canRead: true,
      canPay: true,
      canAdmin: false,
      usageLimited: false,
      NetworkLimit: ["Preprod"],
      RemainingUsageCredits: [],
      status: "Active",
      walletScopeEnabled: true,
      WalletScopes: [
        { hotWalletId: "wallet-existing" },
        { hotWalletId: "wallet-new" },
      ],
    });
    const updateApiKeyMock = vi.fn();
    createPaymentNodeClientMock
      .mockReturnValueOnce({
        getApiKeyStatus: getApiKeyStatusMock,
      })
      .mockReturnValueOnce({
        updateApiKey: updateApiKeyMock,
      });
    agentReferenceFindManyMock.mockResolvedValue([
      { sellingWalletId: "wallet-existing" },
    ]);
    inboxAgentReferenceFindManyMock.mockResolvedValue([]);

    const { ensureUserPaymentNodeKeyScopedToWallets } =
      await import("./wallet-scopes");

    await ensureUserPaymentNodeKeyScopedToWallets({
      userId: "user-1",
      walletIds: ["wallet-new"],
    });

    expect(updateApiKeyMock).not.toHaveBeenCalled();
    expect(inboxAgentReferenceFindManyMock).not.toHaveBeenCalled();
  });
});
