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
  // Parse as an exact decimal string. Going through Number() would lose
  // precision and, for large or scientific-notation inputs, emit strings like
  // "1e+27" instead of a base-unit integer. Since this value becomes an
  // on-chain price we must keep it exact.
  const trimmed = amount.trim();
  // Accept plain decimal notation with an optional leading/trailing dot
  // (".5", "5."), but reject scientific notation, signs, and other garbage —
  // the same invalid class the old Number()-based check rejected.
  const match = /^(\d*)(?:\.(\d*))?$/.exec(trimmed);
  const intPart = match?.[1] ?? "";
  const fracPart = match?.[2] ?? "";
  if (!match || intPart + fracPart === "") {
    throw new Error("Invalid price amount");
  }
  // Keep `decimals` fractional digits exactly and round the remainder half-up
  // (as the previous Math.round did), using BigInt so large values stay exact
  // instead of collapsing to "1e+27".
  const kept = fracPart.slice(0, asset.decimals).padEnd(asset.decimals, "0");
  const scaled = BigInt((intPart || "0") + kept);
  const roundUp = fracPart.charAt(asset.decimals) >= "5";
  return (roundUp ? scaled + 1n : scaled).toString();
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
