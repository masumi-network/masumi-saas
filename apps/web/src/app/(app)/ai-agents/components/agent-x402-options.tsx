"use client";

import type { SupportedPaymentSource } from "@masumi/payment-source-x402/payment-source";
import { getEvmFixedPrice } from "@masumi/payment-source-x402/payment-source";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { ChainLabel } from "@/components/x402/chain-icon";
import { X402Logo } from "@/components/x402/x402-logo";
import { useChainRegistryIcons } from "@/hooks/use-chain-registry-icons";
import type { X402NetworkOption } from "@/lib/hooks/use-x402-networks";
import { usePaymentNodeSupportedX402Networks } from "@/lib/hooks/use-x402-networks";
import { formatX402Amount, shortenAddress } from "@/lib/utils";
import { getEvmTokenPresetsForChain } from "@/lib/x402/evm-token-presets";

type EvmPaymentSource = Extract<SupportedPaymentSource, { chain: "EVM" }>;

export function agentHasX402Options(
  sources: SupportedPaymentSource[] | null | undefined,
): boolean {
  return (sources ?? []).some(
    (source) => source.chain === "EVM" && getEvmFixedPrice(source) != null,
  );
}

export function shouldShowAgentX402Options(
  sources: SupportedPaymentSource[] | null | undefined,
  pricing: { pricingType?: string } | null | undefined,
): boolean {
  if (pricing?.pricingType === "Free" || pricing?.pricingType === "Dynamic") {
    return false;
  }
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

export function agentsTableShowsX402Column(
  agents: Array<{
    supportedPaymentSources: SupportedPaymentSource[] | null;
    pricing: { pricingType?: string } | null;
  }>,
): boolean {
  return agents.some((agent) =>
    shouldShowAgentX402Options(agent.supportedPaymentSources, agent.pricing),
  );
}

export function AgentX402TableCell({
  sources,
  pricing,
  networks,
  emptyLabel = "—",
}: {
  sources: SupportedPaymentSource[] | null | undefined;
  pricing: { pricingType?: string } | null | undefined;
  networks: X402NetworkOption[];
  emptyLabel?: string;
}) {
  if (!shouldShowAgentX402Options(sources, pricing)) {
    return <span className="text-sm text-muted-foreground">{emptyLabel}</span>;
  }

  const evmSources = (sources ?? []).filter(
    (source): source is EvmPaymentSource =>
      source.chain === "EVM" && getEvmFixedPrice(source) != null,
  );

  return (
    <div className="space-y-2">
      {evmSources.map((source) => {
        const fixed = getEvmFixedPrice(source);
        if (!fixed) return null;
        const network = networks.find(
          (item) => item.caip2Id === source.network,
        );
        const chainName = network?.displayName ?? source.network;
        const assetLabel = assetDisplayLabel(
          source.network,
          fixed.asset,
          network?.defaultAsset,
        );
        const amountLabel = `${formatX402Amount(fixed.amount, fixed.decimals)} ${assetLabel}`;

        return (
          <div
            key={`${source.network}-${fixed.asset}-${source.payTo}`}
            className="min-w-0"
            title={`${chainName} · ${amountLabel}`}
          >
            <p className="text-xs leading-none text-muted-foreground">
              {chainName}
            </p>
            <p className="text-sm tabular-nums leading-tight">{amountLabel}</p>
          </div>
        );
      })}
    </div>
  );
}

export function AgentX402Options({
  sources,
}: {
  sources: SupportedPaymentSource[] | null | undefined;
}) {
  const t = useTranslations("App.X402.AgentOptions");
  const tBrand = useTranslations("App.X402");
  const { networks } = usePaymentNodeSupportedX402Networks({
    silentErrors: true,
    allEnvironments: true,
  });
  const evmSources = (sources ?? []).filter(
    (source): source is EvmPaymentSource =>
      source.chain === "EVM" && getEvmFixedPrice(source) != null,
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
          const fixed = getEvmFixedPrice(source);
          if (!fixed) return null;
          const network = networks.find(
            (item) => item.caip2Id === source.network,
          );
          const chainName = network?.displayName ?? source.network;
          const assetLabel = assetDisplayLabel(
            source.network,
            fixed.asset,
            network?.defaultAsset,
          );

          return (
            <div
              key={`${source.network}-${fixed.asset}-${source.payTo}`}
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
                    {formatX402Amount(fixed.amount, fixed.decimals)}
                  </p>
                  <p
                    className="mt-0.5 font-mono text-xs text-muted-foreground"
                    title={fixed.asset}
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
