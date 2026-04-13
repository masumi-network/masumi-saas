import "server-only";

import type {
  GeneratedWallet,
  PaymentNodeClient,
  PaymentNodeNetwork,
  PaymentSourceInfo,
  PaymentSourceWallet,
} from "@/lib/payment-node";
import { createPaymentNodeClient, paymentNodeConfig } from "@/lib/payment-node";

import {
  isWalletAddressCompatibleWithNetwork,
  resolveRegistrationFundingWallet,
} from "../payment-node/registration-wallets";

const PAYMENT_SOURCE_PAGE_SIZE = 100;
const MAX_PAYMENT_SOURCE_PAGES = 10;

type ManagedInboxRegistrationResult =
  | {
      success: true;
      sellingWallet: GeneratedWallet;
      sellingWalletId: string;
      fundingWallet: PaymentSourceWallet;
    }
  | {
      success: false;
      error: string;
    };

export async function listPaymentSourcesForNetwork(
  client: PaymentNodeClient,
  network: PaymentNodeNetwork,
): Promise<PaymentSourceInfo[]> {
  const sources: PaymentSourceInfo[] = [];
  let cursorId: string | undefined;

  for (let page = 0; page < MAX_PAYMENT_SOURCE_PAGES; page += 1) {
    const result = await client.getPaymentSources({
      take: PAYMENT_SOURCE_PAGE_SIZE,
      cursorId,
    });

    const pageItems = result.PaymentSources.filter(
      (source) => source.network === network,
    );
    sources.push(...pageItems);

    if (result.PaymentSources.length < PAYMENT_SOURCE_PAGE_SIZE) {
      break;
    }

    const nextCursor = result.PaymentSources.at(-1)?.id;
    if (!nextCursor || nextCursor === cursorId) {
      break;
    }
    cursorId = nextCursor;
  }

  return sources;
}

function findPaymentSourceBySellingWallet(
  paymentSources: PaymentSourceInfo[],
  sellingWalletVkey: string,
): PaymentSourceInfo | null {
  return (
    paymentSources.find((paymentSource) =>
      paymentSource.SellingWallets.some(
        (wallet: PaymentSourceInfo["SellingWallets"][number]) =>
          wallet.walletVkey === sellingWalletVkey,
      ),
    ) ?? null
  );
}

export async function prepareManagedInboxRegistration(params: {
  name: string;
  network: PaymentNodeNetwork;
}): Promise<ManagedInboxRegistrationResult> {
  let baseUrl: string;
  let adminKey: string;
  let paymentSourceId: string;
  try {
    baseUrl = paymentNodeConfig.getBaseUrl();
    adminKey = paymentNodeConfig.getAdminApiKey();
    paymentSourceId = paymentNodeConfig.getPaymentSourceId();
  } catch (error) {
    console.error("Payment node config missing for inbox registration:", error);
    return {
      success: false,
      error: "Something went wrong. Please try again later.",
    };
  }

  const adminClient = createPaymentNodeClient(baseUrl, adminKey);
  const sellingWallet = await adminClient.generateWallet(params.network);
  const paymentSource = await adminClient.addWalletsToPaymentSource({
    paymentSourceId,
    AddSellingWallets: [
      {
        walletMnemonic: sellingWallet.walletMnemonic,
        note: `Inbox agent: ${params.name} (selling)`,
        collectionAddress: null,
      },
    ],
  });

  if (paymentSource.network && paymentSource.network !== params.network) {
    console.error("[Payment Node] Payment source network mismatch:", {
      paymentSourceId,
      expectedNetwork: params.network,
      actualNetwork: paymentSource.network,
    });
    return {
      success: false,
      error: `Configured payment source ${paymentSourceId} is on ${paymentSource.network}, but inbox-agent registration is using ${params.network}. Update PAYMENT_NODE_PAYMENT_SOURCE_ID to a ${params.network} payment source.`,
    };
  }

  if (
    !isWalletAddressCompatibleWithNetwork(
      sellingWallet.walletAddress,
      params.network,
    )
  ) {
    console.error("[Payment Node] Generated inbox wallet network mismatch:", {
      walletAddress: sellingWallet.walletAddress,
      expectedNetwork: params.network,
    });
    return {
      success: false,
      error: `Generated inbox wallet address does not match ${params.network}. Please verify the payment node wallet configuration and try again.`,
    };
  }

  const sellingWalletId =
    paymentSource.SellingWallets.find(
      (wallet) => wallet.walletVkey === sellingWallet.walletVkey,
    )?.id ?? null;
  if (!sellingWalletId) {
    console.error("[Payment Node] Could not resolve managed inbox wallet ID:", {
      walletVkey: sellingWallet.walletVkey,
      paymentSourceId,
    });
    return {
      success: false,
      error:
        "Could not attach the new inbox wallet to the payment source. Please try again.",
    };
  }

  const fundingWalletResult = resolveRegistrationFundingWallet({
    network: params.network,
    paymentSourceId,
    sellingWallets: paymentSource.SellingWallets,
  });
  if (!fundingWalletResult.wallet) {
    return {
      success: false,
      error:
        fundingWalletResult.error ??
        "No registration funding wallet is available for this payment source.",
    };
  }

  return {
    success: true,
    sellingWallet,
    sellingWalletId,
    fundingWallet: fundingWalletResult.wallet,
  };
}

export async function resolveInboxSmartContractAddress(
  client: PaymentNodeClient,
  network: PaymentNodeNetwork,
  sellingWalletVkey: string,
): Promise<string | null> {
  const paymentSources = await listPaymentSourcesForNetwork(client, network);
  return (
    findPaymentSourceBySellingWallet(paymentSources, sellingWalletVkey)
      ?.smartContractAddress ?? null
  );
}
