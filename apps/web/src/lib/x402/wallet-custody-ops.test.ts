import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  deleteWallet: vi.fn(),
  cancelLocal: vi.fn(),
}));
vi.mock("@masumi/database/client", () => ({
  default: { x402EvmWallet: { findFirst: mocks.findFirst } },
}));
vi.mock("@masumi/payment-source-x402", () => ({
  resolveX402TenantScope: (x: unknown) => x,
  walletOwnershipWhere: () => ({}),
  cancelX402PendingWallet: mocks.cancelLocal,
}));
vi.mock("@/lib/payment-node/get-user-client", () => ({
  getPaymentNodeClientForUser: async () => ({
    deleteX402Wallet: mocks.deleteWallet,
  }),
}));
vi.mock("./wallet-custody", () => ({ usesPaymentNodeCustody: () => true }));
vi.mock("./payment-node-wallet-network", () => ({}));
vi.mock("@/lib/payment-node/errors", () => ({}));
import { cancelX402PendingWalletWithCustody } from "./wallet-custody-ops";
describe("pending wallet cancellation", () => {
  beforeEach(() => vi.clearAllMocks());
  it("rejects a confirmed wallet before deleting its custodied key", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "wallet",
      paymentNodeWalletId: "node-wallet",
      encryptedPrivateKey: null,
      backupConfirmedAt: new Date(),
    });
    mocks.cancelLocal.mockRejectedValue(
      Object.assign(new Error("Only pending wallets can be cancelled"), {
        status: 409,
      }),
    );
    await expect(
      cancelX402PendingWalletWithCustody("user", { userId: "user" }, "wallet"),
    ).rejects.toMatchObject({ status: 409 });
    expect(mocks.deleteWallet).not.toHaveBeenCalled();
  });
  it("cancels an unconfirmed wallet on both stores", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "wallet",
      paymentNodeWalletId: "node-wallet",
      encryptedPrivateKey: null,
      backupConfirmedAt: null,
    });
    mocks.cancelLocal.mockResolvedValue({ id: "wallet" });
    await expect(
      cancelX402PendingWalletWithCustody("user", { userId: "user" }, "wallet"),
    ).resolves.toEqual({ id: "wallet" });
    expect(mocks.deleteWallet).toHaveBeenCalledWith({ id: "node-wallet" });
  });
});
