import { beforeEach, describe, expect, it, vi } from "vitest";

const userUpdateMock = vi.fn();
const createPaymentNodeClientMock = vi.fn();
const encryptPaymentNodeSecretMock = vi.fn();
const getBaseUrlMock = vi.fn();
const getAdminApiKeyMock = vi.fn();

vi.mock("@masumi/database/client", () => ({
  default: {
    user: {
      update: userUpdateMock,
    },
  },
}));

vi.mock("@/lib/payment-node", () => ({
  createPaymentNodeClient: createPaymentNodeClientMock,
  encryptPaymentNodeSecret: encryptPaymentNodeSecretMock,
  paymentNodeConfig: {
    getBaseUrl: getBaseUrlMock,
    getAdminApiKey: getAdminApiKeyMock,
  },
}));

describe("createPaymentNodeKeyForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBaseUrlMock.mockReturnValue("https://payment.example.com/api/v1");
    getAdminApiKeyMock.mockReturnValue("admin-key");
    encryptPaymentNodeSecretMock.mockResolvedValue("encrypted-token");
    userUpdateMock.mockResolvedValue({});
  });

  it("creates wallet-scoped payment keys by default", async () => {
    const createApiKeyMock = vi.fn().mockResolvedValue({
      id: "api-key-1",
      token: "raw-token",
      permission: "ReadAndPay",
      canRead: true,
      canPay: true,
      canAdmin: false,
      usageLimited: false,
      NetworkLimit: ["Preprod", "Mainnet"],
      RemainingUsageCredits: [],
      status: "Active",
      walletScopeEnabled: true,
      WalletScopes: [],
    });
    createPaymentNodeClientMock.mockReturnValue({
      createApiKey: createApiKeyMock,
    });

    const { createPaymentNodeKeyForUser } = await import("./on-signup");

    await createPaymentNodeKeyForUser("user-1");

    expect(createApiKeyMock).toHaveBeenCalledWith({
      permission: "ReadAndPay",
      NetworkLimit: ["Preprod", "Mainnet"],
      usageLimited: "false",
      UsageCredits: [],
      walletScopeEnabled: "true",
      WalletScopeHotWalletIds: [],
    });
    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { paymentNodeApiKeyEncrypted: "encrypted-token" },
    });
  });
});
