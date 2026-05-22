"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

type DashboardStatsMobileStripProps = {
  agentCount: number;
  newTransactionsCount: number;
};

export function DashboardStatsMobileStrip({
  agentCount,
  newTransactionsCount,
}: DashboardStatsMobileStripProps) {
  const t = useTranslations("App.Home.Dashboard.stats");

  const segmentClassName =
    "group flex min-w-0 flex-1 items-center justify-center gap-2 px-3 py-3 transition-colors hover:bg-muted/40";

  return (
    <div className="flex min-w-0 divide-x divide-border/80 overflow-hidden rounded-xl border border-border/80 bg-background/95">
      <Link
        href="/ai-agents"
        className={segmentClassName}
        aria-label={t("agentsCardAria", { count: agentCount })}
      >
        <p className="shrink-0 font-mono text-2xl font-semibold tabular-nums leading-none tracking-tight">
          {agentCount}
        </p>
        <p className="min-w-0 text-xs leading-snug text-muted-foreground">
          {t("agentsStripLabel")}
        </p>
      </Link>
      <Link
        href="/activity"
        className={segmentClassName}
        aria-label={t("newTransactionsCardAria", {
          count: newTransactionsCount,
        })}
      >
        <p className="shrink-0 font-mono text-2xl font-semibold tabular-nums leading-none tracking-tight">
          {newTransactionsCount}
        </p>
        <p className="min-w-0 text-xs leading-snug text-muted-foreground text-balance">
          {t("newTransactions")}
        </p>
      </Link>
    </div>
  );
}
