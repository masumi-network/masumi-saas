import type { PaymentNodeNetwork } from "./client";

interface TokenConfig {
  policyId: string;
  assetName: string; // hex-encoded
  /** policyId + assetName, no separator — used as the `unit` in payment node API calls */
  unit: string;
  symbol: string;
  decimals: number;
}

export const USDM: Record<PaymentNodeNetwork, TokenConfig> = {
  Preprod: {
    policyId: "16a55b2a349361ff88c03788f93e1e966e5d689605d044fef722ddde",
    assetName: "0014df10745553444d", // "tUSDM"
    unit: "16a55b2a349361ff88c03788f93e1e966e5d689605d044fef722ddde0014df10745553444d",
    symbol: "tUSDM",
    decimals: 6,
  },
  Mainnet: {
    policyId: "c48cbb3d5e57ed56e276bc45f99ab39abe94e6cd7ac39fb402da47ad",
    assetName: "0014df105553444d", // "USDM"
    unit: "c48cbb3d5e57ed56e276bc45f99ab39abe94e6cd7ac39fb402da47ad0014df105553444d",
    symbol: "USDM",
    decimals: 6,
  },
};
