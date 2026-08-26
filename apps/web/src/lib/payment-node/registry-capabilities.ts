import {
  listSettleablePaymentNodeX402Networks,
  type SettleableX402Network,
} from "@/lib/payment-node/resolve-payment-node-x402-network";

export type NetworkRegisterCapabilities = {
  /** Browser wallet mint sends the registry NFT to a connected external address. */
  browserWalletMintSupported: boolean;
  /** EVM chains the payment node can settle for agent registration x402 ads. */
  x402SettleableNetworks: SettleableX402Network[];
};

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (value == null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return undefined;
}

/**
 * External registry recipients require payment-service `dev` (#727) or newer on
 * main. Until deployed, production returns 404 for browser-wallet mint paths.
 */
export function getBrowserWalletMintSupported(): boolean {
  const explicit = parseOptionalBoolean(
    process.env.PAYMENT_NODE_SUPPORTS_EXTERNAL_REGISTRY_RECIPIENT,
  );
  if (explicit !== undefined) {
    return explicit;
  }

  const baseUrl = process.env.PAYMENT_NODE_BASE_URL?.trim() ?? "";
  const isLocalPaymentNode = /localhost|127\.0\.0\.1/i.test(baseUrl);

  return isLocalPaymentNode;
}

/** Sync subset for code paths that only need the browser-wallet flag. */
export function getNetworkRegisterCapabilities(): Pick<
  NetworkRegisterCapabilities,
  "browserWalletMintSupported"
> {
  return { browserWalletMintSupported: getBrowserWalletMintSupported() };
}

/** Full public register capabilities, including settleable x402 chains. */
export async function fetchNetworkRegisterCapabilities(): Promise<NetworkRegisterCapabilities> {
  let x402SettleableNetworks: SettleableX402Network[] = [];
  try {
    x402SettleableNetworks = await listSettleablePaymentNodeX402Networks({
      refresh: true,
    });
  } catch (error) {
    console.error(
      "[Network Register] Failed to list settleable x402 networks",
      error,
    );
  }

  return {
    browserWalletMintSupported: getBrowserWalletMintSupported(),
    x402SettleableNetworks,
  };
}

export const BROWSER_WALLET_MINT_DISABLED_TOOLTIP =
  "Browser wallet mint is temporarily unavailable until the payment node update is deployed to main. Use managed wallet for now.";
