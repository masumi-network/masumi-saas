import { beforeEach, describe, expect, it, vi } from "vitest";

const agentReferenceFindManyMock = vi.fn();
const inboxAgentReferenceFindManyMock = vi.fn();
const getPaymentNodeApiKeyTokenForUserMock = vi.fn();
const createPaymentNodeClientMock = vi.fn();
const getBaseUrlMock = vi.fn();
const getAdminApiKeyMock = vi.fn();

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
    getPaymentNodeApiKeyTokenForUserMock.mockResolvedValue("user-key");
  });

  it("enables wallet scope while preserving current payment-node wallet IDs", async () => {
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
        "wallet-inbox",
        "wallet-new",
      ],
    });
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
  });
});
