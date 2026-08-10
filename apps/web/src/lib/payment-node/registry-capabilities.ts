export type NetworkRegisterCapabilities = {
  /** Browser wallet mint sends the registry NFT to a connected external address. */
  browserWalletMintSupported: boolean;
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
export function getNetworkRegisterCapabilities(): NetworkRegisterCapabilities {
  const explicit = parseOptionalBoolean(
    process.env.PAYMENT_NODE_SUPPORTS_EXTERNAL_REGISTRY_RECIPIENT,
  );
  if (explicit !== undefined) {
    return { browserWalletMintSupported: explicit };
  }

  const baseUrl = process.env.PAYMENT_NODE_BASE_URL?.trim() ?? "";
  const isLocalPaymentNode = /localhost|127\.0\.0\.1/i.test(baseUrl);

  return { browserWalletMintSupported: isLocalPaymentNode };
}

export const BROWSER_WALLET_MINT_DISABLED_TOOLTIP =
  "Browser wallet mint is temporarily unavailable until the payment node update is deployed to main. Use managed wallet for now.";
