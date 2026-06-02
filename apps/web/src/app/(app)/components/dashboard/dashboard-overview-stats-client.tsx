"use client";

import type { ReactNode } from "react";

import { useNewTransactionsCount } from "@/lib/hooks/useNewTransactionsCount";

import { DashboardActivitySummaryCard } from "./dashboard-activity-summary-card";
import { DashboardStatsMobileStrip } from "./dashboard-stats-mobile-strip";

type DashboardOverviewStatsClientProps = {
  agentCount: number;
  agentsCard: ReactNode;
};

export function DashboardOverviewStatsClient({
  agentCount,
  agentsCard,
}: DashboardOverviewStatsClientProps) {
  const { newTransactionsCount } = useNewTransactionsCount();

  return (
    <>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 fill-mode-both delay-75 md:hidden">
        <DashboardStatsMobileStrip
          agentCount={agentCount}
          newTransactionsCount={newTransactionsCount}
        />
      </div>
      {agentsCard}
      <div className="hidden animate-in fade-in slide-in-from-bottom-4 duration-300 fill-mode-both delay-150 md:block">
        <DashboardActivitySummaryCard
          newTransactionsCount={newTransactionsCount}
        />
      </div>
    </>
  );
}
