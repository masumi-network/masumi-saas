"use client";

import type { SupportedPaymentSource } from "@masumi/payment-source-x402/payment-source";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useX402Networks } from "@/lib/hooks/use-x402";
import { cn, formatX402Amount, shortenAddress } from "@/lib/utils";

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

export function AgentX402Options({
  sources,
}: {
  sources: SupportedPaymentSource[] | null | undefined;
}) {
  const t = useTranslations("App.X402.AgentOptions");
  const { networks } = useX402Networks({ silentErrors: true });
  const evmSources = (sources ?? []).filter(
    (source): source is EvmPaymentSource => source.chain === "EVM",
  );

  if (evmSources.length === 0) return null;

  const chainLabel = (caip2: string) =>
    networks.find((network) => network.caip2Id === caip2)?.displayName ?? caip2;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 rounded-md border bg-muted/40 p-2">
          {evmSources.map((source, index, arr) => (
            <div
              key={`${source.network}-${source.asset}-${source.payTo}`}
              className={cn(
                "flex flex-col gap-1 py-2",
                index < arr.length - 1 && "border-b",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {chainLabel(source.network)}
                </span>
                <span className="font-mono font-medium">
                  {t("amountLine", {
                    amount: formatX402Amount(source.amount, source.decimals),
                    asset: shortenAddress(source.asset, 6),
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("payTo")}</span>
                <span className="font-mono">
                  {shortenAddress(source.payTo, 6)}
                </span>
              </div>
              {source.resource && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("resource")}</span>
                  <span
                    className="max-w-[220px] truncate font-mono"
                    title={source.resource}
                  >
                    {source.resource}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
