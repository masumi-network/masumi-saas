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
}

export function CreditBalanceLink({ className }: CreditBalanceLinkProps) {
  const tHeader = useTranslations("App.Header");
  const { data, isPending, isError } = useCreditBalance();

  const formattedCredits = data
    ? formatCreditAmount(data.creditsRemaining)
    : isPending
      ? "..."
      : "—";

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
      <Link
        href="/top-up"
        aria-label={`${tHeader("credits")}: ${formattedCredits}`}
        title={`${tHeader("credits")}: ${formattedCredits}`}
      >
        <Coins className="h-4 w-4 shrink-0" />
        <span className="hidden lg:inline">{tHeader("credits")}</span>
        <span className="hidden font-mono text-xs tabular-nums md:inline">
          {isError ? "—" : formattedCredits}
        </span>
        <ArrowUpRight className="hidden h-3.5 w-3.5 shrink-0 opacity-70 md:inline" />
      </Link>
    </Button>
  );
}
