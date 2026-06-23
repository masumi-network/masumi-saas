"use client";

import { ArrowUpRight, Coins } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { formatCreditAmount } from "@/lib/credits/format";
import { useCreditBalance } from "@/lib/hooks/use-credit-balance";
import { cn } from "@/lib/utils";

interface CreditBalanceLinkProps {
  className?: string;
  /** When Stripe top-up is off, still show credits but omit link to `/top-up`. */
  balanceLinkToTopUp?: boolean;
}

export function CreditBalanceLink({
  className,
  balanceLinkToTopUp = true,
}: CreditBalanceLinkProps) {
  const tHeader = useTranslations("App.Header");
  const tTopUp = useTranslations("App.TopUp");
  const { data, isPending, isError } = useCreditBalance();

  const formattedCredits = data
    ? formatCreditAmount(data.creditsRemaining)
    : isPending
      ? "..."
      : "—";

  const title = `${tHeader("credits")}: ${formattedCredits}`;

  const inner = (
    <>
      <Coins className="h-4 w-4 shrink-0" />
      <span className="hidden lg:inline">{tHeader("credits")}</span>
      <span className="hidden font-mono text-xs tabular-nums whitespace-nowrap md:inline">
        {isError ? "—" : formattedCredits}
      </span>
      {balanceLinkToTopUp ? (
        <ArrowUpRight className="hidden h-3.5 w-3.5 shrink-0 opacity-70 md:inline" />
      ) : null}
    </>
  );

  if (balanceLinkToTopUp) {
    return (
      <Button
        variant="outline"
        size="sm"
        asChild
        className={cn(
          "h-8 w-8 gap-0 p-0 md:h-9 md:w-auto md:gap-2 md:px-3",
          className,
        )}
      >
        <Link href="/top-up" aria-label={tTopUp("title")} title={title}>
          {inner}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "h-8 w-8 gap-0 p-0 md:h-9 md:w-auto md:gap-2 md:px-3",
        className,
      )}
      title={title}
      aria-label={title}
    >
      {inner}
    </Button>
  );
}
