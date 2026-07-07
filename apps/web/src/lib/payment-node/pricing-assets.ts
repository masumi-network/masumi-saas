import type { PaymentNodeNetwork } from "./client";
import { USDCX, USDM } from "./tokens";

export const ADA_PRICING_ASSET_ID = "ADA";

export type PricingAssetOption = {
  id: string;
  symbol: string;
  unit: string;
  decimals: number;
  /** Pegged ~1:1 with USD (USDM / USDCx). */
  isStableUsd: boolean;
};

export function getDefaultPricingAssetId(network: PaymentNodeNetwork): string {
  return network === "Mainnet" ? USDCX.symbol : USDM[network].symbol;
}

export function getPricingAssetOptions(
  network: PaymentNodeNetwork,
): PricingAssetOption[] {
  const stablecoins =
    network === "Mainnet"
      ? [
          {
            id: USDCX.symbol,
            symbol: USDCX.symbol,
            unit: USDCX.unit,
            decimals: USDCX.decimals,
            isStableUsd: true,
          },
          {
            id: USDM.Mainnet.symbol,
            symbol: USDM.Mainnet.symbol,
            unit: USDM.Mainnet.unit,
            decimals: USDM.Mainnet.decimals,
            isStableUsd: true,
          },
        ]
      : [
          {
            id: USDM.Preprod.symbol,
            symbol: USDM.Preprod.symbol,
            unit: USDM.Preprod.unit,
            decimals: USDM.Preprod.decimals,
            isStableUsd: true,
          },
        ];

  return [
    ...stablecoins,
    {
      id: ADA_PRICING_ASSET_ID,
      symbol: ADA_PRICING_ASSET_ID,
      unit: "",
      decimals: 6,
      isStableUsd: false,
    },
  ];
}

export function resolvePricingAssetOption(
  assetId: string | undefined,
  network: PaymentNodeNetwork,
): PricingAssetOption {
  const options = getPricingAssetOptions(network);
  const normalized = assetId?.trim();
  const match =
    options.find((option) => option.id === normalized) ??
    options.find((option) => option.symbol === normalized);
  if (match) return match;

  const fallback = options.find(
    (option) => option.id === getDefaultPricingAssetId(network),
  );
  return fallback ?? options[0]!;
}

export function humanAmountToSmallestUnit(
  amount: string,
  asset: PricingAssetOption,
): string {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Invalid price amount");
  }
  return String(Math.round(value * 10 ** asset.decimals));
}

export function estimatePriceUsd(
  amount: string,
  assetId: string | undefined,
  network: PaymentNodeNetwork,
  adaUsdRate: number | null | undefined,
): number | null {
  const trimmed = amount.trim();
  if (!trimmed) return null;

  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return null;

  const asset = resolvePricingAssetOption(assetId, network);
  if (asset.isStableUsd) return value;
  if (asset.id === ADA_PRICING_ASSET_ID) {
    if (!adaUsdRate || !Number.isFinite(adaUsdRate) || adaUsdRate <= 0) {
      return null;
    }
    return value * adaUsdRate;
  }

  return null;
}
