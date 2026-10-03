import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteX402ManagedWallet } from "./wallets.js";

const mocks = vi.hoisted(() => ({
  findWallet: vi.fn(),
  updateWallet: vi.fn(),
  updateBudgets: vi.fn(),
  updateRules: vi.fn(),
  updateNetworks: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@masumi/database/client", () => ({
  default: {
    x402EvmWallet: { findFirst: mocks.findWallet, update: mocks.updateWallet },
    x402WalletBudget: { updateMany: mocks.updateBudgets },
    x402EvmWalletLowBalanceRule: { updateMany: mocks.updateRules },
    x402Network: { updateMany: mocks.updateNetworks },
    $transaction: mocks.transaction,
  },
}));
describe("global wallet retirement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findWallet.mockResolvedValue({ id: "wallet" });
    mocks.transaction.mockImplementation(async (operations) =>
      Promise.all(operations),
    );
  });
  it("clears every tenant network association when retiring a global wallet", async () => {
    await deleteX402ManagedWallet(
      {
        userId: "u",
        organizationId: "org",
        caip2NetworkLimit: ["eip155:84532"],
      },
      "wallet",
    );
    expect(mocks.updateNetworks).toHaveBeenCalledWith({
      where: { organizationId: "org", facilitatorWalletId: "wallet" },
      data: { facilitatorWalletId: null },
    });
  });
});
