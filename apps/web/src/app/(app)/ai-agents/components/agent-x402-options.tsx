"use client";

import type { SupportedPaymentSource } from "@masumi/payment-source-x402/payment-source";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { ChainLabel } from "@/components/x402/chain-icon";
import { X402Logo } from "@/components/x402/x402-logo";
import { useChainRegistryIcons } from "@/hooks/use-chain-registry-icons";
import { useX402Networks } from "@/lib/hooks/use-x402";
import { formatX402Amount, shortenAddress } from "@/lib/utils";
import { getEvmTokenPresetsForChain } from "@/lib/x402/evm-token-presets";

type EvmPaymentSource = Extract<SupportedPaymentSource, { chain: "EVM" }>;

export function agentHasX402Options(
  sources: SupportedPaymentSource[] | null | undefined,
): boolean {
  return (sources ?? []).some((source) => source.chain === "EVM");
}

export function shouldShowAgentX402Options(
  sources: SupportedPaymentSource[] | null | undefined,
  pricing: { pricingType?: string } | null | undefined,
): boolean {
  if (pricing?.pricingType === "Free") return false;
  return agentHasX402Options(sources);
}

function assetDisplayLabel(
  caip2Network: string,
  asset: string,
  defaultAsset: string | null | undefined,
) {
  const preset = getEvmTokenPresetsForChain(caip2Network, defaultAsset).find(
    (item) => item.address.toLowerCase() === asset.toLowerCase(),
  );
  return preset?.label ?? shortenAddress(asset, 6);
}

export function AgentX402Options({
  sources,
}: {
  sources: SupportedPaymentSource[] | null | undefined;
}) {
  const t = useTranslations("App.X402.AgentOptions");
  const tBrand = useTranslations("App.X402");
  const { networks } = useX402Networks({
    silentErrors: true,
    allEnvironments: true,
  });
  const evmSources = (sources ?? []).filter(
    (source): source is EvmPaymentSource => source.chain === "EVM",
  );
  const chainIconSlugs = useChainRegistryIcons(
    useMemo(() => evmSources.map((source) => source.network), [evmSources]),
  );

  if (evmSources.length === 0) return null;

  return (
    <section
      className="space-y-3 rounded-xl border border-border/80 bg-muted/10 p-4"
      aria-labelledby="agent-x402-options-heading"
    >
      <h3
        id="agent-x402-options-heading"
        className="flex items-center gap-2 text-sm font-medium leading-none"
      >
        <X402Logo className="h-6 shrink-0" />
        <span className="sr-only">{tBrand("title")} </span>
        {t("title").replace(/^x402\s+/i, "")}
      </h3>

      <div className="space-y-2">
        {evmSources.map((source, index) => {
          const network = networks.find(
            (item) => item.caip2Id === source.network,
          );
          const chainName = network?.displayName ?? source.network;
          const assetLabel = assetDisplayLabel(
            source.network,
            source.asset,
            network?.defaultAsset,
          );

          return (
            <div
              key={`${source.network}-${source.asset}-${source.payTo}`}
              className="rounded-lg border border-border/80 bg-background p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  {evmSources.length > 1 ? (
                    <Badge
                      variant="secondary"
                      className="h-5 px-1.5 text-[10px]"
                    >
                      {t("optionLabel", { n: index + 1 })}
                    </Badge>
                  ) : null}
                  <ChainLabel
                    caip2Id={source.network}
                    name={chainName}
                    iconSlug={chainIconSlugs.get(source.network)}
                    className="min-w-0"
                  />
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm font-medium tabular-nums">
                    {formatX402Amount(source.amount, source.decimals)}
                  </p>
                  <p
                    className="mt-0.5 font-mono text-xs text-muted-foreground"
                    title={source.asset}
                  >
                    {assetLabel}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                <span className="text-xs text-muted-foreground">
                  {t("payTo")}
                </span>
                <div className="flex min-w-0 items-center gap-1">
                  <span
                    className="truncate font-mono text-xs"
                    title={source.payTo}
                  >
                    {shortenAddress(source.payTo, 8)}
                  </span>
                  <CopyButton
                    value={source.payTo}
                    className="h-7 w-7 shrink-0"
                  />
                </div>
              </div>

              {source.resource ? (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {t("resource")}
                  </span>
                  <div className="flex min-w-0 items-center gap-1">
                    <span
                      className="max-w-[200px] truncate font-mono text-xs text-muted-foreground"
                      title={source.resource}
                    >
                      {source.resource}
                    </span>
                    <CopyButton
                      value={source.resource}
                      className="h-7 w-7 shrink-0"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
