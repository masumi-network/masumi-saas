"use client";

import { Coins } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { formatCreditAmount } from "@/lib/credits/format";
import { useMainnetRegistrationCreditsGate } from "@/lib/hooks/use-mainnet-registration-credits-gate";
import { cn } from "@/lib/utils";

type MainnetCreditsRequiredNoticeProps = {
  className?: string;
  /** When false, still show copy but hide the top-up button (Stripe disabled). */
  showTopUpLink?: boolean;
};

export function MainnetCreditsRequiredNotice({
  className,
  showTopUpLink = true,
}: MainnetCreditsRequiredNoticeProps) {
  const t = useTranslations("App.Agents.CreditsGate");
  const { isBlocked, isPending, isMainnet, creditsRemaining } =
    useMainnetRegistrationCreditsGate();

  if (!isMainnet || isPending || !isBlocked) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      role="status"
    >
      <div className="flex gap-3">
        <Coins
          className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400"
          aria-hidden
        />
        <div className="space-y-1 text-sm">
          <p className="font-medium text-foreground">{t("title")}</p>
          <p className="text-muted-foreground">
            {t("description", {
              credits: formatCreditAmount(creditsRemaining),
            })}
          </p>
        </div>
      </div>
      {showTopUpLink ? (
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href="/top-up">{t("buyCredits")}</Link>
        </Button>
      ) : null}
    </div>
  );
}
