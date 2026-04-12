import { beforeEach, describe, expect, it, vi } from "vitest";

const getRegistrationFundingWalletsMock = vi.fn();

vi.mock("@masumi/database/client", () => ({
  default: {
    agent: {
      findUniqueOrThrow: vi.fn(),
    },
  },
}));

vi.mock("@/lib/activity-event", () => ({
  recordAgentActivityEvent: vi.fn(),
}));

vi.mock("@/lib/email/send-registration-complete", () => ({
  sendAgentRegistrationCompleteEmail: vi.fn(),
}));

vi.mock("@/lib/email/send-registration-failed", () => ({
  sendAgentRegistrationFailedEmail: vi.fn(),
}));

vi.mock("@/lib/payment-node", () => ({
  createPaymentNodeClient: vi.fn(),
  paymentNodeConfig: {
    getRegistrationFundingWallets: getRegistrationFundingWalletsMock,
  },
}));

vi.mock("@/lib/payment-node/get-user-client", () => ({
  getPaymentNodeClientForUser: vi.fn(),
}));

vi.mock("@/lib/payment-node/tokens", () => ({
  USDM: {
    Preprod: { unit: "usdm_preprod", decimals: 6 },
    Mainnet: { unit: "usdm_mainnet", decimals: 6 },
  },
}));

const {
  resolveRegistrationFundingWallet,
  shouldCheckRecipientWalletForRegisteredAssets,
} = await import("./agent-registration");

describe("resolveRegistrationFundingWallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
