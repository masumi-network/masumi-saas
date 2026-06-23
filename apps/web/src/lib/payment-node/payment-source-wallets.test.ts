import { describe, expect, it, vi } from "vitest";

import type { PaymentNodeClient } from "@/lib/payment-node/client";
import type { PaymentSourceInfo } from "@/lib/payment-node/schemas";
import { getPaymentSourcesOutputSchema } from "@/lib/payment-node/schemas";

import {
  fetchWalletsForPaymentSource,
  findSellingWalletIdByVkey,
  hydratePaymentSource,
  hydratePaymentSources,
  listSellingWalletIdsByAddresses,
} from "./payment-source-wallets";

const slimPaymentSource: PaymentSourceInfo = {
  id: "payment-source-preprod",
  network: "Preprod",
  smartContractAddress: "addr_test1contract",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  policyId: null,
  lastIdentifierChecked: null,
  lastCheckedAt: null,
  AdminWallets: [],
  PurchasingWallets: [],
  SellingWallets: [],
  FeeReceiverNetworkWallet: null,
  feeRatePermille: 50,
};

function createClientMock(
  wallets: Array<{
    id: string;
    paymentSourceId: string;
    type: "Selling" | "Purchasing";
    walletVkey: string;
    walletAddress: string;
    note?: string | null;
    collectionAddress?: string | null;
  }>,
): PaymentNodeClient {
  return {
    getWalletList: vi.fn(
      async (params?: {
        paymentSourceId?: string;
        walletType?: "Selling" | "Purchasing";
        walletVkey?: string;
        walletAddress?: string;
      }) => ({
        Wallets: wallets
          .filter((wallet) =>
            params?.paymentSourceId
              ? wallet.paymentSourceId === params.paymentSourceId
              : true,
          )
          .filter((wallet) =>
            params?.walletType ? wallet.type === params.walletType : true,
          )
          .filter((wallet) =>
            params?.walletVkey ? wallet.walletVkey === params.walletVkey : true,
          )
          .filter((wallet) =>
            params?.walletAddress
              ? wallet.walletAddress === params.walletAddress
              : true,
          )
          .map((wallet) => ({
            collectionAddress: wallet.collectionAddress ?? null,
            note: wallet.note ?? null,
            ...wallet,
          })),
      }),
    ),
  } as unknown as PaymentNodeClient;
}

describe("payment-source-wallets", () => {
  it("parses slim GET /payment-source responses without embedded wallet arrays", () => {
    const parsed = getPaymentSourcesOutputSchema.parse({
      PaymentSources: [
        {
          id: "payment-source-preprod",
          network: "Preprod",
          smartContractAddress: "addr_test1contract",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          policyId: null,
          lastIdentifierChecked: null,
          lastCheckedAt: null,
          paymentSourceType: "Web3CardanoV1",
          requiredAdminSignatures: null,
          AdminWallets: [{ walletAddress: "addr_admin", order: 0 }],
          FeeReceiverNetworkWallet: { walletAddress: "addr_fee" },
          feeRatePermille: 50,
        },
      ],
    });

    expect(parsed.PaymentSources[0]?.PurchasingWallets).toEqual([]);
    expect(parsed.PaymentSources[0]?.SellingWallets).toEqual([]);
  });

  it("hydrates slim GET /payment-source rows from GET /wallet/list", async () => {
    const client = createClientMock([
      {
        id: "wallet-selling",
        paymentSourceId: slimPaymentSource.id,
        type: "Selling",
        walletVkey: "selling-vkey",
        walletAddress: "addr_test1selling",
      },
      {
        id: "wallet-buying",
        paymentSourceId: slimPaymentSource.id,
        type: "Purchasing",
        walletVkey: "buying-vkey",
        walletAddress: "addr_test1buying",
      },
    ]);

    const hydrated = await hydratePaymentSource(client, slimPaymentSource);

    expect(hydrated.SellingWallets).toHaveLength(1);
    expect(hydrated.SellingWallets[0]?.id).toBe("wallet-selling");
    expect(hydrated.PurchasingWallets).toHaveLength(1);
    expect(hydrated.PurchasingWallets[0]?.id).toBe("wallet-buying");
  });

  it("hydrates multiple payment sources in one wallet-list pass", async () => {
    const client = createClientMock([
      {
        id: "wallet-a",
        paymentSourceId: "source-a",
        type: "Selling",
        walletVkey: "a-vkey",
        walletAddress: "addr_a",
      },
      {
        id: "wallet-b",
        paymentSourceId: "source-b",
        type: "Selling",
        walletVkey: "b-vkey",
        walletAddress: "addr_b",
      },
    ]);

    const hydrated = await hydratePaymentSources(client, [
      { ...slimPaymentSource, id: "source-a" },
      { ...slimPaymentSource, id: "source-b" },
    ]);

    expect(hydrated[0]?.SellingWallets.map((wallet) => wallet.id)).toEqual([
      "wallet-a",
    ]);
    expect(hydrated[1]?.SellingWallets.map((wallet) => wallet.id)).toEqual([
      "wallet-b",
    ]);
  });

  it("finds a selling wallet id by vkey after PATCH extended returns counts only", async () => {
    const client = createClientMock([
      {
        id: "wallet-new",
        paymentSourceId: slimPaymentSource.id,
        type: "Selling",
        walletVkey: "new-vkey",
        walletAddress: "addr_test1new",
      },
    ]);

    await expect(
      findSellingWalletIdByVkey(client, slimPaymentSource.id, "new-vkey"),
    ).resolves.toBe("wallet-new");
  });

  it("maps configured funding wallet addresses to wallet ids", async () => {
    const client = createClientMock([
      {
        id: "wallet-funding",
        paymentSourceId: slimPaymentSource.id,
        type: "Selling",
        walletVkey: "funding-vkey",
        walletAddress: "addr_test1funding",
      },
      {
        id: "wallet-other",
        paymentSourceId: "other-source",
        type: "Selling",
        walletVkey: "other-vkey",
        walletAddress: "addr_test1other",
      },
    ]);

    await expect(
      listSellingWalletIdsByAddresses(
        client,
        new Set(["addr_test1funding", "addr_missing"]),
      ),
    ).resolves.toEqual(["wallet-funding"]);
  });

  it("fetchWalletsForPaymentSource scopes wallet list to one payment source", async () => {
    const client = createClientMock([
      {
        id: "wallet-local",
        paymentSourceId: slimPaymentSource.id,
        type: "Selling",
        walletVkey: "local-vkey",
        walletAddress: "addr_local",
      },
      {
        id: "wallet-remote",
        paymentSourceId: "other-source",
        type: "Selling",
        walletVkey: "remote-vkey",
        walletAddress: "addr_remote",
      },
    ]);

    const wallets = await fetchWalletsForPaymentSource(
      client,
      slimPaymentSource.id,
    );

    expect(wallets.SellingWallets.map((wallet) => wallet.id)).toEqual([
      "wallet-local",
    ]);
    expect(client.getWalletList).toHaveBeenCalledWith(
      expect.objectContaining({ paymentSourceId: slimPaymentSource.id }),
    );
  });
});
