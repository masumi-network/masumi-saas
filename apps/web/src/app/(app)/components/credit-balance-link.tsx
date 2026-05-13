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
  const tTopUp = useTranslations("App.TopUp");
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
      className={cn("h-8 gap-2 px-2.5 md:h-9 md:px-3", className)}
    >
      <Link
        href="/top-up"
        aria-label={tTopUp("title")}
        title={`${tHeader("credits")}: ${formattedCredits}`}
      >
        <Coins className="h-4 w-4 shrink-0" />
        <span className="hidden lg:inline">{tHeader("credits")}</span>
        <span className="font-mono text-xs tabular-nums">
          {isError ? "—" : formattedCredits}
        </span>
        <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
      </Link>
    </Button>
  );
}
