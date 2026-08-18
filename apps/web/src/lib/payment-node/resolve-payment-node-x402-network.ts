import "server-only";

import { tryCreateAdminPaymentNodeClient } from "@/lib/payment-node/get-admin-client";
import { paymentNodeX402NetworkListSchema } from "@/lib/payment-node/x402-schemas";
import { PAYMENT_NODE_CHAIN_UNSUPPORTED_CODE } from "@/lib/x402/error-codes";
import { ApiError } from "@/server/hono/errors";

const BASE_MAINNET_CAIP2 = "eip155:8453";
const BASE_SEPOLIA_CAIP2 = "eip155:84532";

export type PaymentNodeX402Network = {
  id: string;
  caip2Id: string;
  displayName: string;
  rpcUrl: string;
  isTestnet: boolean;
  isEnabled: boolean;
  defaultAsset: string | null;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedNetworks: PaymentNodeX402Network[] | null = null;
let cacheExpiresAt = 0;

function inferDefaultIsTestnet(): boolean {
  const hasPreprod =
    !!process.env.PAYMENT_NODE_PAYMENT_SOURCE_ID_PREPROD?.trim();
  const hasMainnet =
    !!process.env.PAYMENT_NODE_PAYMENT_SOURCE_ID_MAINNET?.trim();
  if (hasPreprod && !hasMainnet) return true;
  if (hasMainnet && !hasPreprod) return false;
  return true;
}

async function loadPaymentNodeX402Networks(): Promise<
  PaymentNodeX402Network[]
> {
  const now = Date.now();
  if (cachedNetworks != null && now < cacheExpiresAt) {
    return cachedNetworks;
  }

  const client = tryCreateAdminPaymentNodeClient();
  if (client == null) {
    throw new ApiError(503, "Payment node admin API is not configured");
  }

  const parsed = paymentNodeX402NetworkListSchema.parse(
    await client.listX402Networks(),
  );
  cachedNetworks = parsed.Networks.map((network) => ({
    id: network.id,
    caip2Id: network.caip2Id,
    displayName: network.displayName,
    rpcUrl: network.rpcUrl,
    isTestnet: network.isTestnet,
    isEnabled: network.isEnabled,
    defaultAsset: network.defaultAsset,
  }));
  cacheExpiresAt = now + CACHE_TTL_MS;
  return cachedNetworks;
}

/** Enabled x402 networks registered on the payment node (admin list, cached). */
export async function listPaymentNodeX402Networks(options?: {
  isTestnet?: boolean;
}): Promise<PaymentNodeX402Network[]> {
  const networks = await loadPaymentNodeX402Networks();
  const enabled = networks.filter((network) => network.isEnabled);
  if (options?.isTestnet === undefined) {
    return enabled;
  }
  return enabled.filter((network) => network.isTestnet === options.isTestnet);
}

/**
 * CAIP-2 chain ids to grant on new user API keys — mirrors enabled x402
 * networks registered on the payment node (falls back to Base testnet/mainnet
 * when the list is empty or unavailable so signup can still proceed).
 */
export async function resolveSignupChainIdLimit(): Promise<string[]> {
  try {
    const networks = await listPaymentNodeX402Networks();
    const chainIds = [...new Set(networks.map((network) => network.caip2Id))];
    if (chainIds.length > 0) {
      return chainIds;
    }
  } catch (error) {
    console.error(
      "[Payment Node] Failed to list x402 networks for signup ChainIdLimit",
      error,
    );
  }
  return [BASE_SEPOLIA_CAIP2, BASE_MAINNET_CAIP2];
}

/** Default chain for new custody wallets: Base Sepolia (testnet) or Base Mainnet. */
export async function resolveDefaultPaymentNodeCaip2Network(
  isTestnet: boolean = inferDefaultIsTestnet(),
): Promise<string> {
  const networks = await listPaymentNodeX402Networks({ isTestnet });
  const preferred = isTestnet ? BASE_SEPOLIA_CAIP2 : BASE_MAINNET_CAIP2;
  const match = networks.find((network) => network.caip2Id === preferred);
  if (match != null) return match.caip2Id;
  const fallback = networks[0];
  if (fallback == null) {
    throw new ApiError(
      503,
      "No enabled x402 networks are registered on the payment node",
    );
  }
  return fallback.caip2Id;
}

/** Resolve a CAIP-2 id to the payment-node X402Network.id (admin list, cached). */
export async function resolvePaymentNodeNetworkId(
  caip2Network: string,
): Promise<string> {
  const networks = await loadPaymentNodeX402Networks();
  const match = networks.find(
    (network) => network.caip2Id === caip2Network && network.isEnabled,
  );
  if (match == null) {
    throw new ApiError(
      404,
      "This chain is not supported by the payment node.",
      {
        extraBody: {
          code: PAYMENT_NODE_CHAIN_UNSUPPORTED_CODE,
          caip2Network,
        },
      },
    );
  }
  return match.id;
}

export async function getPaymentNodeX402NetworkByCaip2(
  caip2Network: string,
): Promise<PaymentNodeX402Network> {
  const networks = await loadPaymentNodeX402Networks();
  const match = networks.find(
    (network) => network.caip2Id === caip2Network && network.isEnabled,
  );
  if (match == null) {
    throw new ApiError(
      404,
      "This chain is not supported by the payment node.",
      {
        extraBody: {
          code: PAYMENT_NODE_CHAIN_UNSUPPORTED_CODE,
          caip2Network,
        },
      },
    );
  }
  return match;
}

/** Test helper: clear the in-memory network cache between cases. */
export function clearPaymentNodeX402NetworkCacheForTests(): void {
  cachedNetworks = null;
  cacheExpiresAt = 0;
}
