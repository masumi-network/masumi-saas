import type { PaymentNodeNetwork } from "./client";

export interface TokenConfig {
  policyId: string;
  assetName: string; // hex-encoded
  /** policyId + assetName, no separator — used as the `unit` in payment node API calls */
  unit: string;
  symbol: string;
  decimals: number;
  aliases?: string[];
}

export const USDM: Record<PaymentNodeNetwork, TokenConfig> = {
  Preprod: {
    policyId: "16a55b2a349361ff88c03788f93e1e966e5d689605d044fef722ddde",
    assetName: "0014df10745553444d", // "tUSDM"
    unit: "16a55b2a349361ff88c03788f93e1e966e5d689605d044fef722ddde0014df10745553444d",
    symbol: "tUSDM",
    decimals: 6,
    aliases: ["tUSDM"],
  },
  Mainnet: {
    policyId: "c48cbb3d5e57ed56e276bc45f99ab39abe94e6cd7ac39fb402da47ad",
    assetName: "0014df105553444d", // "USDM"
    unit: "c48cbb3d5e57ed56e276bc45f99ab39abe94e6cd7ac39fb402da47ad0014df105553444d",
    symbol: "USDM",
    decimals: 6,
    aliases: ["USDM"],
  },
};

export const USDCX: TokenConfig = {
  policyId: "1f3aec8bfe7ea4fe14c5f121e2a92e301afe414147860d557cac7e34",
  assetName: "5553444378", // "USDCx"
  unit: "1f3aec8bfe7ea4fe14c5f121e2a92e301afe414147860d557cac7e345553444378",
  symbol: "USDCx",
  decimals: 6,
  aliases: ["USDCx", "USDC"],
};

export const STABLECOINS_BY_NETWORK: Record<PaymentNodeNetwork, TokenConfig[]> =
  {
    Preprod: [USDM.Preprod],
    Mainnet: [USDM.Mainnet, USDCX],
  };

const KNOWN_PAYMENT_TOKENS: TokenConfig[] = [
  ...STABLECOINS_BY_NETWORK.Preprod,
  ...STABLECOINS_BY_NETWORK.Mainnet,
];

export function getKnownTokenByUnit(unit: string): TokenConfig | null {
  const normalized = unit.trim();
  if (!normalized) return null;

  return (
    KNOWN_PAYMENT_TOKENS.find(
      (token) =>
        token.unit === normalized ||
        token.policyId === normalized ||
        token.symbol === normalized ||
        token.aliases?.includes(normalized),
    ) ?? null
  );
}

export function getKnownStableTokenByUnit(
  unit: string,
  network?: PaymentNodeNetwork,
): TokenConfig | null {
  const normalized = unit.trim();
  if (!normalized) return null;

  const candidates = network
    ? STABLECOINS_BY_NETWORK[network]
    : KNOWN_PAYMENT_TOKENS;

  return (
    candidates.find(
      (token) =>
        token.unit === normalized ||
        token.policyId === normalized ||
        token.symbol === normalized ||
        token.aliases?.includes(normalized),
    ) ?? null
  );
}
