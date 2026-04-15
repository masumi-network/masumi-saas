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
          id: "managed-1",
          walletVkey: "managed_vkey",
          walletAddress: "addr_test1managed",
          collectionAddress: null,
          note: "Managed wallet",
        },
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
          id: "managed-1",
          walletVkey: "managed_vkey",
          walletAddress: "addr_test1managed",
          collectionAddress: null,
          note: "Managed wallet",
        },
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
      sellingWalletId: "managed-1",
      fundingWallet: {
        id: "funding-1",
        walletVkey: "funding_vkey",
        walletAddress: "addr_test1funding",
        collectionAddress: null,
        note: "Funding wallet",
      },
    });
  });

  it("uses the Mainnet payment source configured for Mainnet requests", async () => {
    generateWalletMock.mockResolvedValue({
      walletMnemonic: "managed mnemonic",
      walletAddress: "addr1managed",
      walletVkey: "managed_vkey_mainnet",
    });
    addWalletsToPaymentSourceMock.mockResolvedValue({
      id: "payment-source-mainnet",
      network: "Mainnet",
      SellingWallets: [
        {
          id: "managed-mainnet",
          walletVkey: "managed_vkey_mainnet",
          walletAddress: "addr1managed",
          collectionAddress: null,
          note: "Managed wallet",
        },
        {
          id: "funding-mainnet",
          walletVkey: "funding_vkey_mainnet",
          walletAddress: "addr1funding",
          collectionAddress: null,
          note: "Funding wallet",
        },
      ],
      PurchasingWallets: [],
    });
    resolveRegistrationFundingWalletMock.mockReturnValue({
      wallet: {
        id: "funding-mainnet",
        walletVkey: "funding_vkey_mainnet",
        walletAddress: "addr1funding",
        collectionAddress: null,
        note: "Funding wallet",
      },
    });

    const { prepareManagedInboxRegistration } = await import("./server");
    const result = await prepareManagedInboxRegistration({
      name: "Mainnet inbox",
      network: "Mainnet",
    });

    expect(getPaymentSourceIdMock).toHaveBeenCalledWith("Mainnet");
    expect(addWalletsToPaymentSourceMock).toHaveBeenCalledWith({
      paymentSourceId: "payment-source-mainnet",
      AddSellingWallets: [
        {
          walletMnemonic: "managed mnemonic",
          note: "Inbox agent: Mainnet inbox (selling)",
          collectionAddress: null,
        },
      ],
    });
    expect(result).toStrictEqual({
      success: true,
      sellingWallet: {
        walletMnemonic: "managed mnemonic",
        walletAddress: "addr1managed",
        walletVkey: "managed_vkey_mainnet",
      },
      sellingWalletId: "managed-mainnet",
      fundingWallet: {
        id: "funding-mainnet",
        walletVkey: "funding_vkey_mainnet",
        walletAddress: "addr1funding",
        collectionAddress: null,
        note: "Funding wallet",
      },
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
