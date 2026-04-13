import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();
const getPaymentNodeApiKeyTokenForUserMock = vi.fn();
const createPaymentNodeClientMock = vi.fn();
const getBaseUrlMock = vi.fn();
const getAdminApiKeyMock = vi.fn();

vi.mock("@masumi/database/client", () => ({
  default: {
    agentReference: {
      findMany: findManyMock,
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

  it("enables wallet scope and unions current, known, and requested wallet IDs", async () => {
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
      WalletScopes: [{ hotWalletId: "wallet-existing" }],
    });
    const updateApiKeyMock = vi.fn().mockResolvedValue({});
    createPaymentNodeClientMock
      .mockReturnValueOnce({
        getApiKeyStatus: getApiKeyStatusMock,
      })
      .mockReturnValueOnce({
        updateApiKey: updateApiKeyMock,
      });
    findManyMock.mockResolvedValue([
      { sellingWalletId: "wallet-known" },
      { sellingWalletId: "wallet-existing" },
    ]);

    const { ensureUserPaymentNodeKeyScopedToWallets } =
      await import("./wallet-scopes");

    await ensureUserPaymentNodeKeyScopedToWallets({
      userId: "user-1",
      walletIds: ["wallet-new", "wallet-funding", "wallet-new"],
    });

    expect(updateApiKeyMock).toHaveBeenCalledWith({
      id: "api-key-1",
      walletScopeEnabled: true,
      WalletScopeHotWalletIds: [
        "wallet-existing",
        "wallet-known",
        "wallet-new",
        "wallet-funding",
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
    findManyMock.mockResolvedValue([{ sellingWalletId: "wallet-existing" }]);

    const { ensureUserPaymentNodeKeyScopedToWallets } =
      await import("./wallet-scopes");

    await ensureUserPaymentNodeKeyScopedToWallets({
      userId: "user-1",
      walletIds: ["wallet-new"],
    });

    expect(updateApiKeyMock).not.toHaveBeenCalled();
  });
});
