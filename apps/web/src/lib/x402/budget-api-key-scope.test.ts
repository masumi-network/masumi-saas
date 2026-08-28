import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstNetworkMock = vi.fn();
const findFirstApiKeyMock = vi.fn();
const findFirstWalletMock = vi.fn();
const upsertBudgetMock = vi.fn();

vi.mock("@masumi/database/client", () => ({
  default: {
    x402Network: {
      findFirst: findFirstNetworkMock,
    },
    apikey: {
      findFirst: findFirstApiKeyMock,
    },
    x402EvmWallet: {
      findFirst: findFirstWalletMock,
    },
    x402WalletBudget: {
      upsert: upsertBudgetMock,
    },
  },
  X402EvmWalletType: {
    Purchasing: "Purchasing",
    Selling: "Selling",
  },
}));

describe("setX402WalletBudget API key ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstNetworkMock.mockResolvedValue({
      caip2Id: "eip155:84532",
      userId: "user-1",
      id: "network-1",
    });
    findFirstWalletMock.mockResolvedValue({
      id: "wallet-1",
      type: "Purchasing",
      address: "0x1111111111111111111111111111111111111111",
    });
    upsertBudgetMock.mockResolvedValue({
      id: "budget-1",
      apiKeyId: "key-1",
      evmWalletId: "wallet-1",
      caip2Network: "eip155:84532",
      asset: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
      remainingAmount: 1000n,
      spentAmount: 0n,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("rejects API keys that do not belong to the authenticated user", async () => {
    findFirstApiKeyMock.mockResolvedValue(null);

    const { setX402WalletBudget } = await import("@masumi/payment-source-x402");

    await expect(
      setX402WalletBudget({
        userId: "user-1",
        apiKeyId: "key-1",
        evmWalletId: "wallet-1",
        caip2Network: "eip155:84532",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        remainingAmount: "1000",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(upsertBudgetMock).not.toHaveBeenCalled();
  });

  it("allows API keys owned by the authenticated user", async () => {
    findFirstApiKeyMock.mockResolvedValue({ id: "key-1" });

    const { setX402WalletBudget } = await import("@masumi/payment-source-x402");

    await expect(
      setX402WalletBudget({
        userId: "user-1",
        apiKeyId: "key-1",
        evmWalletId: "wallet-1",
        caip2Network: "eip155:84532",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        remainingAmount: "1000",
      }),
    ).resolves.toMatchObject({ id: "budget-1" });
  });
});
