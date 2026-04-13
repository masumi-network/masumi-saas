"use client";

import { ArrowUpDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNewTransactionsCount } from "@/lib/hooks/useNewTransactionsCount";

export function DashboardActivitySummaryCard() {
  const t = useTranslations("App.Home.Dashboard.stats");
  const { newTransactionsCount } = useNewTransactionsCount();

  const ariaLabel = t("newTransactionsCardAria", {
    count: newTransactionsCount,
  });

  return (
    <Link
      href="/activity?tab=transactions"
      className="block h-full min-h-0"
      aria-label={ariaLabel}
    >
      <Card className="group flex h-full min-h-0 flex-col rounded-xl border border-border/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
        <CardHeader className="space-y-0 pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-tight text-muted-foreground transition-colors group-hover:underline flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 shrink-0" />
            {t("newTransactions")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight">
            {newTransactionsCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("newTransactionsDescription")}
          </p>
          <p className="mt-auto pt-2 text-xs text-primary font-medium flex items-center gap-0.5 group-hover:underline">
            {t("viewAllTransactions")}
            <ChevronRight className="h-3.5 w-3.5" />
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
