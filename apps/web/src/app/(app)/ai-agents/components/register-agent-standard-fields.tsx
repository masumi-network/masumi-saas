"use client";

import { CircleHelp, Plug, Sparkles } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import { LangdockConnectionFields } from "@/components/integrations/langdock-connection-fields";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { type AgentPriceField, PricingFields } from "./pricing-fields";
import type { RegisterAgentController } from "./use-register-agent-controller";
import { X402OptionsSection } from "./x402-options-section";

// Runtime, pricing and payout fields shown only for standard (non-x402) registrations.
export function RegisterAgentStandardFields({
  controller,
}: {
  controller: RegisterAgentController;
}) {
  const {
    t,
    form,
    network,
    runtimeProvider,
    pricingType,
    connections,
    connectionsLoading,
    testingLangdock,
    testLangdockAndAutofill,
    handleLangdockConnectionSelect,
    x402Options,
    x402Networks,
    x402NetworksLoading,
    setX402Options,
    x402Error,
  } = controller;

  return (
    <>
      <FormField
        control={form.control}
        name="runtimeProvider"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("runtimeProvider")}</FormLabel>
            <FormControl>
              <div
                className="grid gap-3 sm:grid-cols-2"
                role="radiogroup"
                aria-label={t("runtimeProvider")}
              >
                {(
                  [
                    {
                      value: "DIRECT_MIP" as const,
                      titleKey: "runtimeDirectTitle",
                      descKey: "runtimeDirectDescription",
                      Icon: Plug,
                    },
                    {
                      value: "LANGDOCK" as const,
                      titleKey: "runtimeLangdockTitle",
                      descKey: "runtimeLangdockDescription",
                      Icon: Sparkles,
                    },
                  ] as const
                ).map((opt) => {
                  const selected = field.value === opt.value;
                  const Icon = opt.Icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={cn(
                        "rounded-lg border p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        selected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border/80 bg-muted/20 hover:bg-muted/40",
                      )}
                      onClick={() => field.onChange(opt.value)}
                    >
                      <span className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <Icon className="h-4 w-4" />
                        {t(opt.titleKey)}
                      </span>
                      <span className="block text-xs text-muted-foreground leading-snug">
                        {t(opt.descKey)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {runtimeProvider === "DIRECT_MIP" ? (
        <FormField
          control={form.control}
          name="apiUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("apiUrl")}</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  placeholder={t("apiUrlPlaceholder")}
                  {...field}
                  className="h-11 font-mono text-sm"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : (
        <LangdockConnectionFields
          control={form.control}
          connections={connections}
          connectionsLoading={connectionsLoading}
          testingLangdock={testingLangdock}
          onTest={() => void testLangdockAndAutofill()}
          onConnectionSelect={handleLangdockConnectionSelect}
          t={t}
        />
      )}

      <FormField
        control={form.control}
        name="pricingType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("pricingModel")}</FormLabel>
            <FormControl>
              <div
                className="grid gap-3 sm:grid-cols-3"
                role="radiogroup"
                aria-label={t("pricingModel")}
              >
                {(
                  [
                    {
                      value: "Free" as const,
                      titleKey: "pricingFreeTitle",
                      descKey: "pricingFreeDescription",
                    },
                    {
                      value: "Fixed" as const,
                      titleKey: "pricingFixedTitle",
                      descKey: "pricingFixedDescription",
                    },
                    {
                      value: "Dynamic" as const,
                      titleKey: "pricingDynamicTitle",
                      descKey: "pricingDynamicDescription",
                    },
                  ] as const
                ).map((opt) => {
                  const selected = field.value === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={cn(
                        "rounded-lg border p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        selected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border/80 bg-muted/20 hover:bg-muted/40",
                      )}
                      onClick={() => field.onChange(opt.value)}
                    >
                      <p className="text-sm font-medium">{t(opt.titleKey)}</p>
                      <p className="mt-1 text-xs text-muted-foreground leading-snug">
                        {t(opt.descKey)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {pricingType === "Dynamic" && (
        <div className="rounded-lg border border-dashed border-primary/35 bg-muted/30 px-4 py-3 text-sm text-muted-foreground leading-relaxed">
          <p>{t("pricingDynamicContext")}</p>
          <p className="mt-2">{t("pricingDynamicNoX402")}</p>
        </div>
      )}

      <PricingFields
        form={
          form as unknown as UseFormReturn<{
            prices: AgentPriceField[];
          }>
        }
        t={t}
        pricingMode={pricingType}
        network={network}
      />

      {pricingType !== "Free" ? (
        <FormField
          control={form.control}
          name="payoutAddress"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-1.5">
                <FormLabel>{t("payoutAddress")}</FormLabel>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
                      <CircleHelp className="h-3.5 w-3.5" />
                      <span className="sr-only">{t("payoutAddressHint")}</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    {t("payoutAddressHint")}
                  </TooltipContent>
                </Tooltip>
              </div>
              <FormControl>
                <Input
                  {...field}
                  placeholder={t(
                    network === "Mainnet"
                      ? "payoutAddressPlaceholderMainnet"
                      : "payoutAddressPlaceholderPreprod",
                  )}
                  className="h-11 font-mono text-sm"
                  spellCheck={false}
                  autoComplete="off"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}

      {pricingType === "Fixed" ? (
        <X402OptionsSection
          options={x402Options}
          networks={x402Networks}
          networksLoading={x402NetworksLoading}
          onChange={setX402Options}
          error={x402Error}
          t={t}
        />
      ) : null}
    </>
  );
}
