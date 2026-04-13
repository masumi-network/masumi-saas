import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createPaymentNodeClientMock = vi.fn();
const getBaseUrlMock = vi.fn();
const getAdminApiKeyMock = vi.fn();
const getPaymentSourceIdMock = vi.fn();
const isWalletAddressCompatibleWithNetworkMock = vi.fn();
const resolveRegistrationFundingWalletMock = vi.fn();

const generateWalletMock = vi.fn();
const addWalletsToPaymentSourceMock = vi.fn();

vi.mock("@/lib/payment-node", () => ({
  createPaymentNodeClient: createPaymentNodeClientMock,
  paymentNodeConfig: {
    getBaseUrl: getBaseUrlMock,
    getAdminApiKey: getAdminApiKeyMock,
    getPaymentSourceId: getPaymentSourceIdMock,
  },
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
    getPaymentSourceIdMock.mockReturnValue("payment-source-1");
    isWalletAddressCompatibleWithNetworkMock.mockReturnValue(true);
    createPaymentNodeClientMock.mockReturnValue({
      generateWallet: generateWalletMock,
      addWalletsToPaymentSource: addWalletsToPaymentSourceMock,
    });
  });

  it("creates a managed wallet and reuses the configured funding wallet", async () => {
    generateWalletMock.mockResolvedValue({
      walletMnemonic: "managed mnemonic",
      walletAddress: "addr_test1managed",
      walletVkey: "managed_vkey",
    });
    addWalletsToPaymentSourceMock.mockResolvedValue({
      id: "payment-source-1",
      network: "Preprod",
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
    });
    resolveRegistrationFundingWalletMock.mockReturnValue({
      wallet: {
        id: "funding-1",
        walletVkey: "funding_vkey",
        walletAddress: "addr_test1funding",
        collectionAddress: null,
        note: "Funding wallet",
      },
    });

    const { prepareManagedInboxRegistration } = await import("./server");
    const result = await prepareManagedInboxRegistration({
      name: "Support inbox",
      network: "Preprod",
    });

    expect(addWalletsToPaymentSourceMock).toHaveBeenCalledWith({
      paymentSourceId: "payment-source-1",
      AddSellingWallets: [
        {
          walletMnemonic: "managed mnemonic",
          note: "Inbox agent: Support inbox (selling)",
          collectionAddress: null,
        },
      ],
    });
    expect(resolveRegistrationFundingWalletMock).toHaveBeenCalledWith({
      network: "Preprod",
      paymentSourceId: "payment-source-1",
      sellingWallets: [
        {
          id: "funding-1",
          walletVkey: "funding_vkey",
          walletAddress: "addr_test1funding",
          collectionAddress: null,
          note: "Funding wallet",
        },
      ],
    });
    expect(result).toStrictEqual({
      success: true,
      sellingWallet: {
        walletMnemonic: "managed mnemonic",
        walletAddress: "addr_test1managed",
        walletVkey: "managed_vkey",
      },
      fundingWallet: {
        id: "funding-1",
        walletVkey: "funding_vkey",
        walletAddress: "addr_test1funding",
        collectionAddress: null,
        note: "Funding wallet",
      },
    });
  });
});
