"use client";

import { CircleHelp, Coins, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
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
import type { X402NetworkOption } from "@/lib/hooks/use-x402-networks";
import { cn } from "@/lib/utils";
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
    | "x402EmptyHint"
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
    <div className="space-y-3 rounded-lg border border-dashed border-border/80 bg-background/60 p-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-11 w-full" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}

function X402OptionCard({
  option,
  index,
  networks,
  onUpdate,
  onRemove,
  t,
}: {
  option: X402OptionDraft;
  index: number;
  networks: X402NetworkOption[];
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
            <SelectTrigger className="h-11">
              <SelectValue placeholder={t("x402ChainPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {networks.map((network) => (
                <SelectItem key={network.id} value={network.caip2Id}>
                  <span className="flex items-center gap-2">
                    <span>{network.displayName}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {network.caip2Id}
                    </span>
                    {network.isTestnet ? (
                      <Badge
                        variant="outline"
                        className="h-5 px-1.5 text-[10px]"
                      >
                        {t("x402TestnetBadge")}
                      </Badge>
                    ) : null}
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

  return (
    <section
      className="space-y-4 rounded-xl border border-border/80 bg-muted/20 p-4"
      aria-labelledby="x402-options-heading"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
            <Coins className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 space-y-1">
            <h3
              id="x402-options-heading"
              className="text-sm font-medium leading-none"
            >
              {t("x402Title")}
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("x402Description")}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={!canAdd}
          className="shrink-0 gap-1.5"
        >
          <Plus className="h-4 w-4" />
          {t("x402Add")}
        </Button>
      </div>

      {networksLoading ? <X402OptionsLoadingSkeleton /> : null}

      {!networksLoading && networks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/80 bg-background/60 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          {t("x402NoChains")}{" "}
          <Link
            href="/x402?setup=1"
            className="font-medium text-primary underline underline-offset-2"
          >
            {t("x402SetupLink")}
          </Link>
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {options.length === 0 && canAdd ? (
        <button
          type="button"
          onClick={add}
          className={cn(
            "flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-border/80 bg-background/60 px-4 py-8 text-center transition-colors",
            "hover:border-primary/30 hover:bg-muted/40",
          )}
        >
          <Plus className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">{t("x402Add")}</span>
          <span className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            {t("x402EmptyHint")}
          </span>
        </button>
      ) : null}

      {options.length > 0 ? (
        <div className="space-y-3">
          {options.map((option, index) => (
            <X402OptionCard
              key={index}
              option={option}
              index={index}
              networks={networks}
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
