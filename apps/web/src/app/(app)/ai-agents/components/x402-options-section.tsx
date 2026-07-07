"use client";

import { CircleHelp, Link2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChainLabel } from "@/components/x402/chain-icon";
import { X402Logo } from "@/components/x402/x402-logo";
import { useChainRegistryIcons } from "@/hooks/use-chain-registry-icons";
import type { X402NetworkOption } from "@/lib/hooks/use-x402-networks";
import {
  getDefaultStablecoinForChain,
  getEvmTokenPresetsForChain,
} from "@/lib/x402/evm-token-presets";

import { resolvePayToOnChainChange } from "./x402-option-pay-to";

export type X402OptionDraft = {
  caip2Network: string;
  asset: string;
  amount: string;
  decimals: string;
  payTo: string;
  resource: string;
};

export const emptyX402Option: X402OptionDraft = {
  caip2Network: "",
  asset: "",
  amount: "",
  decimals: "6",
  payTo: "",
  resource: "",
};

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const CAIP2_EIP155 = /^eip155:\d+$/;
const UINT = /^\d+$/;

export function validateX402Options(options: X402OptionDraft[]): string | null {
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    const n = i + 1;
    if (!CAIP2_EIP155.test(option.caip2Network)) {
      return `x402 option ${n}: select a chain`;
    }
    if (!EVM_ADDRESS.test(option.asset)) {
      return `x402 option ${n}: asset must be an EVM address`;
    }
    if (!UINT.test(option.amount) || option.amount === "0") {
      return `x402 option ${n}: amount must be a positive integer in base units`;
    }
    const decimals = Number(option.decimals);
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
      return `x402 option ${n}: decimals must be a whole number between 0 and 255`;
    }
    if (!EVM_ADDRESS.test(option.payTo)) {
      return `x402 option ${n}: pay-to must be an EVM address`;
    }
    if (option.resource && !/^https?:\/\//.test(option.resource)) {
      return `x402 option ${n}: resource must be an http(s) URL`;
    }
  }
  return null;
}

type X402OptionsTranslator = (
  key:
    | "x402Title"
    | "x402Description"
    | "x402Add"
    | "x402NoChains"
    | "x402SetupLink"
    | "x402OptionLabel"
    | "x402RemoveOption"
    | "x402Chain"
    | "x402ChainPlaceholder"
    | "x402TestnetBadge"
    | "x402Asset"
    | "x402AssetPresetPlaceholder"
    | "x402Amount"
    | "x402AmountHint"
    | "x402Decimals"
    | "x402PayTo"
    | "x402PayToHint"
    | "x402PayToNoFacilitator"
    | "x402Resource",
  values?: { n?: number },
) => string;

function X402OptionsLoadingSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border/70 bg-background/40 p-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-11 w-full" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}

function X402NoChainsBanner({ t }: { t: X402OptionsTranslator }) {
  return (
    <div className="flex gap-3 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20">
        <Link2
          className="h-4 w-4 text-amber-600 dark:text-amber-500"
          aria-hidden
        />
      </div>
      <p className="min-w-0 text-xs leading-relaxed text-muted-foreground">
        {t("x402NoChains")}{" "}
        <Link
          href="/x402?setup=1"
          className="font-medium text-primary underline underline-offset-2"
        >
          {t("x402SetupLink")}
        </Link>
      </p>
    </div>
  );
}

function X402OptionCard({
  option,
  index,
  networks,
  chainIconSlugs,
  onUpdate,
  onRemove,
  t,
}: {
  option: X402OptionDraft;
  index: number;
  networks: X402NetworkOption[];
  chainIconSlugs: Map<string, string | null>;
  onUpdate: (patch: Partial<X402OptionDraft>) => void;
  onRemove: () => void;
  t: X402OptionsTranslator;
}) {
  const selectedNetwork = useMemo(
    () => networks.find((network) => network.caip2Id === option.caip2Network),
    [networks, option.caip2Network],
  );
  const tokenPresets = useMemo(
    () =>
      getEvmTokenPresetsForChain(
        option.caip2Network,
        selectedNetwork?.defaultAsset,
      ),
    [option.caip2Network, selectedNetwork?.defaultAsset],
  );
  const selectedPresetId = useMemo(
    () =>
      tokenPresets.find(
        (preset) => preset.address.toLowerCase() === option.asset.toLowerCase(),
      )?.id,
    [option.asset, tokenPresets],
  );

  const handleChainChange = (value: string) => {
    const network = networks.find((item) => item.caip2Id === value);
    const previousNetwork = networks.find(
      (item) => item.caip2Id === option.caip2Network,
    );
    const defaultAsset =
      network?.defaultAsset ?? getDefaultStablecoinForChain(value);
    const patch: Partial<X402OptionDraft> = { caip2Network: value };
    if (defaultAsset && !option.asset.trim()) {
      patch.asset = defaultAsset;
      if (!option.decimals.trim()) {
        patch.decimals = "6";
      }
    }
    const payTo = resolvePayToOnChainChange({
      currentPayTo: option.payTo,
      previousFacilitatorAddress: previousNetwork?.facilitatorWalletAddress,
      nextFacilitatorAddress: network?.facilitatorWalletAddress,
    });
    if (payTo != null) {
      patch.payTo = payTo;
    }
    onUpdate(patch);
  };

  return (
    <div className="rounded-lg border border-border/80 bg-background p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Badge variant="secondary" className="font-medium">
          {t("x402OptionLabel", { n: index + 1 })}
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={onRemove}
          aria-label={t("x402RemoveOption")}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t("x402Chain")}</Label>
          <Select value={option.caip2Network} onValueChange={handleChainChange}>
            <SelectTrigger className="h-auto min-h-11 items-center py-2 text-left [&>span]:line-clamp-none">
              <SelectValue placeholder={t("x402ChainPlaceholder")}>
                {selectedNetwork ? (
                  <ChainLabel
                    caip2Id={selectedNetwork.caip2Id}
                    name={selectedNetwork.displayName}
                    iconSlug={chainIconSlugs.get(selectedNetwork.caip2Id)}
                    className="min-w-0 [&_span]:line-clamp-none"
                  />
                ) : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="min-w-[var(--radix-select-trigger-width)] w-max max-w-[min(100vw-2rem,24rem)]">
              {networks.map((network) => (
                <SelectItem
                  key={network.id}
                  value={network.caip2Id}
                  textValue={network.displayName}
                  className="whitespace-nowrap py-2 [&_span]:line-clamp-none"
                >
                  <span>{network.displayName}</span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {network.caip2Id}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">{t("x402Asset")}</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              className="h-11 font-mono sm:min-w-0 sm:flex-1"
              placeholder="0x…"
              value={option.asset}
              onChange={(e) => onUpdate({ asset: e.target.value })}
              spellCheck={false}
              autoComplete="off"
            />
            {tokenPresets.length > 0 ? (
              <Select
                value={selectedPresetId}
                onValueChange={(id) => {
                  const preset = tokenPresets.find((item) => item.id === id);
                  if (preset) {
                    onUpdate({ asset: preset.address });
                  }
                }}
              >
                <SelectTrigger
                  className="h-11 w-full shrink-0 sm:w-40"
                  aria-label={t("x402AssetPresetPlaceholder")}
                >
                  <SelectValue placeholder={t("x402AssetPresetPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {tokenPresets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm font-medium">{t("x402Amount")}</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
                    <CircleHelp className="h-3.5 w-3.5" />
                    <span className="sr-only">{t("x402AmountHint")}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  {t("x402AmountHint")}
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              className="h-11 font-mono"
              placeholder="1000000"
              inputMode="numeric"
              value={option.amount}
              onChange={(e) => onUpdate({ amount: e.target.value })}
              spellCheck={false}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("x402Decimals")}</Label>
            <Input
              className="h-11 font-mono"
              placeholder="6"
              inputMode="numeric"
              value={option.decimals}
              onChange={(e) => onUpdate({ decimals: e.target.value })}
              spellCheck={false}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label className="text-sm font-medium">{t("x402PayTo")}</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
                  <CircleHelp className="h-3.5 w-3.5" />
                  <span className="sr-only">{t("x402PayToHint")}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {t("x402PayToHint")}
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            className="h-11 font-mono"
            placeholder="0x…"
            value={option.payTo}
            onChange={(e) => onUpdate({ payTo: e.target.value })}
            spellCheck={false}
            autoComplete="off"
          />
          {option.caip2Network && !selectedNetwork?.facilitatorWalletAddress ? (
            <p className="text-xs leading-relaxed text-amber-600 dark:text-amber-500">
              {t("x402PayToNoFacilitator")}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">
            {t("x402Resource")}
          </Label>
          <Input
            className="h-11 font-mono"
            placeholder="https://…"
            value={option.resource}
            onChange={(e) => onUpdate({ resource: e.target.value })}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}

export function X402OptionsSection({
  options,
  networks,
  networksLoading,
  onChange,
  error,
  t,
}: {
  options: X402OptionDraft[];
  networks: X402NetworkOption[];
  networksLoading?: boolean;
  onChange: (next: X402OptionDraft[]) => void;
  error: string | null;
  t: X402OptionsTranslator;
}) {
  const tBrand = useTranslations("App.X402");
  const update = (index: number, patch: Partial<X402OptionDraft>) =>
    onChange(
      options.map((option, i) =>
        i === index ? { ...option, ...patch } : option,
      ),
    );
  const remove = (index: number) =>
    onChange(options.filter((_, i) => i !== index));
  const add = () => onChange([...options, { ...emptyX402Option }]);

  const canAdd = !networksLoading && networks.length > 0;
  const chainIconSlugs = useChainRegistryIcons(
    useMemo(() => networks.map((network) => network.caip2Id), [networks]),
  );

  return (
    <section
      className="space-y-4 rounded-xl border border-border/80 bg-muted/10 p-4"
      aria-labelledby="x402-options-heading"
    >
      <div className="flex items-center justify-between gap-3">
        <h3
          id="x402-options-heading"
          className="flex min-w-0 items-center gap-2 text-sm font-medium leading-none"
        >
          <X402Logo className="h-5 shrink-0 -mb-1" />
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="sr-only">{tBrand("title")} </span>
            {t("x402Title").replace(/^x402\s+/i, "")}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
                  <CircleHelp className="h-3.5 w-3.5" />
                  <span className="sr-only">{t("x402Description")}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {t("x402Description")}
              </TooltipContent>
            </Tooltip>
          </span>
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={!canAdd}
          className="shrink-0 gap-1.5"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t("x402Add")}
        </Button>
      </div>

      {networksLoading ? <X402OptionsLoadingSkeleton /> : null}

      {!networksLoading && networks.length === 0 ? (
        <X402NoChainsBanner t={t} />
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {options.length > 0 ? (
        <div className="space-y-3">
          {options.map((option, index) => (
            <X402OptionCard
              key={index}
              option={option}
              index={index}
              networks={networks}
              chainIconSlugs={chainIconSlugs}
              onUpdate={(patch) => update(index, patch)}
              onRemove={() => remove(index)}
              t={t}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
