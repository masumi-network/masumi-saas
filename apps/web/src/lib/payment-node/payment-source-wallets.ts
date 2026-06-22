/**
 * Hydrate payment sources with hot wallets from GET /wallet/list.
 * GET /payment-source no longer embeds PurchasingWallets / SellingWallets.
 */

import type { PaymentNodeClient } from "@/lib/payment-node/client";
import type {
  PaymentSourceInfo,
  PaymentSourceWallet,
  WalletListItem,
} from "@/lib/payment-node/schemas";

const WALLET_PAGE_SIZE = 100;
const MAX_WALLET_PAGES = 50;

function toPaymentSourceWallet(wallet: WalletListItem): PaymentSourceWallet {
  return {
    id: wallet.id,
    walletVkey: wallet.walletVkey,
    walletAddress: wallet.walletAddress,
    collectionAddress: wallet.collectionAddress,
    note: wallet.note,
  };
}

async function listWallets(
  client: PaymentNodeClient,
  params?: {
    paymentSourceId?: string;
    walletType?: "Selling" | "Purchasing";
    walletVkey?: string;
    walletAddress?: string;
  },
): Promise<WalletListItem[]> {
  const wallets: WalletListItem[] = [];
  let cursorId: string | undefined;

  for (let page = 0; page < MAX_WALLET_PAGES; page += 1) {
    const result = await client.getWalletList({
      take: WALLET_PAGE_SIZE,
      cursorId,
      paymentSourceId: params?.paymentSourceId,
      walletType: params?.walletType,
      walletVkey: params?.walletVkey,
      walletAddress: params?.walletAddress,
    });
    wallets.push(...result.Wallets);

    if (result.Wallets.length < WALLET_PAGE_SIZE) {
      break;
    }

    const nextCursor = result.Wallets.at(-1)?.id;
    if (!nextCursor || nextCursor === cursorId) {
      break;
    }
    cursorId = nextCursor;
  }

  return wallets;
}

export async function fetchWalletsForPaymentSource(
  client: PaymentNodeClient,
  paymentSourceId: string,
): Promise<{
  SellingWallets: PaymentSourceWallet[];
  PurchasingWallets: PaymentSourceWallet[];
}> {
  const wallets = await listWallets(client, { paymentSourceId });
  return {
    SellingWallets: wallets
      .filter((wallet) => wallet.type === "Selling")
      .map(toPaymentSourceWallet),
    PurchasingWallets: wallets
      .filter((wallet) => wallet.type === "Purchasing")
      .map(toPaymentSourceWallet),
  };
}

export async function hydratePaymentSource(
  client: PaymentNodeClient,
  source: PaymentSourceInfo,
): Promise<PaymentSourceInfo> {
  if (source.SellingWallets.length > 0 || source.PurchasingWallets.length > 0) {
    return source;
  }

  const wallets = await fetchWalletsForPaymentSource(client, source.id);
  return { ...source, ...wallets };
}

export async function hydratePaymentSources(
  client: PaymentNodeClient,
  sources: PaymentSourceInfo[],
): Promise<PaymentSourceInfo[]> {
  if (sources.length === 0) return sources;

  const wallets = await listWallets(client);
  const sellingBySource = new Map<string, PaymentSourceWallet[]>();
  const purchasingBySource = new Map<string, PaymentSourceWallet[]>();

  for (const wallet of wallets) {
    const mapped = toPaymentSourceWallet(wallet);
    const target =
      wallet.type === "Selling" ? sellingBySource : purchasingBySource;
    const existing = target.get(wallet.paymentSourceId) ?? [];
    existing.push(mapped);
    target.set(wallet.paymentSourceId, existing);
  }

  return sources.map((source) => ({
    ...source,
    SellingWallets:
      source.SellingWallets.length > 0
        ? source.SellingWallets
        : (sellingBySource.get(source.id) ?? []),
    PurchasingWallets:
      source.PurchasingWallets.length > 0
        ? source.PurchasingWallets
        : (purchasingBySource.get(source.id) ?? []),
  }));
}

export async function findSellingWalletIdByVkey(
  client: PaymentNodeClient,
  paymentSourceId: string,
  walletVkey: string,
): Promise<string | null> {
  const wallets = await listWallets(client, {
    paymentSourceId,
    walletType: "Selling",
    walletVkey,
  });
  return wallets[0]?.id ?? null;
}

export async function listSellingWalletIdsByAddresses(
  client: PaymentNodeClient,
  walletAddresses: Set<string>,
): Promise<string[]> {
  if (walletAddresses.size === 0) return [];

  const wallets = await listWallets(client, { walletType: "Selling" });
  return [
    ...new Set(
      wallets
        .filter((wallet) => walletAddresses.has(wallet.walletAddress))
        .map((wallet) => wallet.id),
    ),
  ];
}
