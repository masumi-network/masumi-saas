"use client";

import { Trash2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { useFieldArray, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdaUsdRate } from "@/lib/hooks/use-ada-usd-rate";
import type { PaymentNodeNetwork } from "@/lib/payment-node";
import {
  estimatePriceUsd,
  getDefaultPricingAssetId,
  getPricingAssetOptions,
} from "@/lib/payment-node/pricing-assets";
import { formatBalance } from "@/lib/utils/format-price";

type PricingMode = "Free" | "Fixed" | "Dynamic";

export type AgentPriceField = {
  amount: string;
  asset: string;
};

type PricingFieldsProps = {
  form: UseFormReturn<{ prices: AgentPriceField[] }>;
  t: (key: string, values?: Record<string, string | number>) => string;
  pricingMode: PricingMode;
  network: PaymentNodeNetwork;
};

function PriceUsdEstimate({
  amount,
  assetId,
  network,
  t,
}: {
  amount: string;
  assetId: string;
  network: PaymentNodeNetwork;
  t: PricingFieldsProps["t"];
}) {
  const { rate } = useAdaUsdRate();
  const estimate = estimatePriceUsd(amount, assetId, network, rate);

  if (estimate == null) return null;

  return (
    <p className="text-xs text-muted-foreground tabular-nums">
      {t("priceUsdEstimate", {
        value: `$${formatBalance(estimate.toFixed(2))}`,
      })}
    </p>
  );
}

export function PricingFields({
  form,
  t,
  pricingMode,
  network,
}: PricingFieldsProps) {
  const fixedLocked = pricingMode !== "Fixed";
  const assetOptions = getPricingAssetOptions(network);
  const defaultAssetId = getDefaultPricingAssetId(network);
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "prices",
  });

  return (
    <div
      className="space-y-3 transition-opacity duration-200"
      style={{
        opacity: fixedLocked ? 0.4 : 1,
        pointerEvents: fixedLocked ? "none" : undefined,
      }}
    >
      <div className="flex items-center justify-between">
        <FormLabel>{t("prices")}</FormLabel>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={fixedLocked}
          onClick={() => append({ amount: "", asset: defaultAssetId })}
        >
          {t("addPrice")}
        </Button>
      </div>
      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="space-y-1.5">
            <div className="flex gap-2 items-start">
              <FormField
                control={form.control}
                name={`prices.${index}.asset`}
                render={({ field: assetField }) => (
                  <FormItem className="shrink-0">
                    <Select
                      value={assetField.value || defaultAssetId}
                      onValueChange={assetField.onChange}
                      disabled={fixedLocked}
                    >
                      <FormControl>
                        <SelectTrigger className="h-11 w-[7.5rem] px-3 font-medium">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {assetOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.symbol}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`prices.${index}.amount`}
                render={({ field: amountField }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input
                        type="number"
                        placeholder={t("amountPlaceholder")}
                        min="0"
                        step="0.01"
                        {...amountField}
                        disabled={fixedLocked}
                        className="h-11"
                        onChange={(e) => amountField.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {fields.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={fixedLocked}
                  onClick={() => remove(index)}
                  className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
            <PriceRowEstimate
              form={form}
              index={index}
              network={network}
              defaultAssetId={defaultAssetId}
              t={t}
            />
          </div>
        ))}
        {form.formState.errors.prices && (
          <p className="text-sm text-destructive">
            {form.formState.errors.prices.message}
          </p>
        )}
      </div>
    </div>
  );
}

function PriceRowEstimate({
  form,
  index,
  network,
  defaultAssetId,
  t,
}: {
  form: UseFormReturn<{ prices: AgentPriceField[] }>;
  index: number;
  network: PaymentNodeNetwork;
  defaultAssetId: string;
  t: PricingFieldsProps["t"];
}) {
  const row = useWatch({
    control: form.control,
    name: `prices.${index}`,
  });

  return (
    <PriceUsdEstimate
      amount={row?.amount ?? ""}
      assetId={row?.asset || defaultAssetId}
      network={network}
      t={t}
    />
  );
}
