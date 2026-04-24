"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  startCreditTopUp,
  type StartCreditTopUpState,
} from "@/lib/actions/credits-top-up.action";
import { TOP_UP_CREDIT_OPTIONS } from "@/lib/stripe/top-up-constants";
import { cn } from "@/lib/utils";

type TopUpPurchaseFormProps = {
  unitLabel: string;
};

export function TopUpPurchaseForm({ unitLabel }: TopUpPurchaseFormProps) {
  const t = useTranslations("App.TopUp");
  const [state, formAction, isPending] = useActionState<
    StartCreditTopUpState | undefined,
    FormData
  >(startCreditTopUp, undefined);

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">
          {t("packageLabel")}
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {TOP_UP_CREDIT_OPTIONS.map((credits) => (
            <label
              key={credits}
              className={cn(
                "flex cursor-pointer flex-col rounded-lg border border-border/80 bg-background/80 px-4 py-3 text-left text-sm font-medium transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 hover:border-primary/40",
              )}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="credits"
                  value={String(credits)}
                  defaultChecked={credits === 25}
                  className="size-4 accent-primary"
                />
                <span className="text-base font-semibold tabular-nums">
                  {credits} {t("creditsWord")}
                </span>
              </span>
              <span className="pl-6 text-xs font-normal text-muted-foreground">
                {unitLabel}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {state && state.ok === false ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
        {isPending ? t("processing") : t("ctaPay")}
      </Button>
    </form>
  );
}
