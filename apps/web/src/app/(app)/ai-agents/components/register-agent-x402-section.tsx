"use client";

import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { FieldProbeIndicator } from "@/components/x402/field-probe-indicator";
import { X402RegistryChainPicker } from "@/components/x402/x402-registry-chain-picker";
import { cn } from "@/lib/utils";

import type { RegisterAgentController } from "./use-register-agent-controller";

export function RegisterAgentX402Section({
  controller,
}: {
  controller: RegisterAgentController;
}) {
  const {
    t,
    form,
    network,
    x402RegistryChainIconSlugs,
    requestPaymentNetworkChange,
    openBatchX402Registration,
    x402Http: {
      x402Probe,
      x402AutofillInProgress,
      x402BatchResourceMode,
      showX402ResourceProbeStatus,
      x402ResourceProbeInFlight,
      x402CanAutofillMetadata,
      handleX402ResourceUrlInput,
      autofillX402Metadata,
    },
  } = controller;

  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">{t("x402Chain")}</Label>
        <X402RegistryChainPicker
          cardanoNetwork={network}
          onCardanoNetworkChange={requestPaymentNetworkChange}
          chainIconSlugs={x402RegistryChainIconSlugs}
        />
      </div>

      <FormField
        control={form.control}
        name="x402ResourceUrl"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between gap-3">
              <FormLabel className="mb-0">{t("x402ResourceUrl")}</FormLabel>
              <Button
                type="button"
                variant="link"
                className={cn(
                  "h-auto shrink-0 px-0 py-0 text-sm font-medium",
                  x402BatchResourceMode
                    ? "text-primary underline-offset-4 hover:underline"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={openBatchX402Registration}
              >
                {t("x402RegisterMultiple")}
              </Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <FormControl>
                <div className="relative flex-1">
                  <Input
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={t("x402ResourceUrlPlaceholder")}
                    {...field}
                    className="h-11 pr-10 font-mono text-sm"
                    onChange={(event) => {
                      field.onChange(event);
                      handleX402ResourceUrlInput(event.target.value);
                    }}
                  />
                  {!x402BatchResourceMode ? (
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center">
                      <div className="pointer-events-auto flex items-center justify-center">
                        <FieldProbeIndicator
                          status={
                            showX402ResourceProbeStatus
                              ? x402Probe.status
                              : "idle"
                          }
                          checkingLabel={t("x402ProbeChecking")}
                          validLabel={t("x402ProbeValid")}
                          invalidMessage={
                            x402Probe.status === "invalid"
                              ? x402Probe.message
                              : undefined
                          }
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </FormControl>
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0 gap-2"
                disabled={
                  x402BatchResourceMode ||
                  !x402CanAutofillMetadata ||
                  x402ResourceProbeInFlight ||
                  x402AutofillInProgress
                }
                onClick={() => void autofillX402Metadata()}
              >
                {x402AutofillInProgress ? (
                  <Spinner className="h-4 w-4 shrink-0" />
                ) : (
                  <Sparkles className="h-4 w-4 shrink-0" />
                )}
                {t("x402AutofillMetadata")}
              </Button>
            </div>
            {x402BatchResourceMode ? (
              <p className="text-sm text-destructive">
                {t("x402MultipleResourcesDetectedPrefix")}{" "}
                <button
                  type="button"
                  className="font-medium underline-offset-4 hover:underline"
                  onClick={openBatchX402Registration}
                >
                  {t("x402RegisterMultipleInstead")}
                </button>
              </p>
            ) : (
              <FormMessage />
            )}
          </FormItem>
        )}
      />
    </>
  );
}
