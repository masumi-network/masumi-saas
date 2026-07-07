"use client";

import { useSearchParams } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { isAgentVerificationFlowEnabled } from "@/lib/config/verification.config";

import { type TabKey, TabSkeleton } from "./agent-tab-skeletons";

export function AgentPageLoading() {
  const searchParams = useSearchParams();
  const agentVerificationUiEnabled = isAgentVerificationFlowEnabled();
  const tabParamRaw = searchParams.get("tab");
  const tabParam = tabParamRaw === "credentials" ? "verification" : tabParamRaw;
  const validTabKeys: TabKey[] = agentVerificationUiEnabled
    ? ["details", "earnings", "transactions", "verification"]
    : ["details", "earnings", "transactions"];
  const activeTab: TabKey =
    tabParam && validTabKeys.includes(tabParam as TabKey)
      ? (tabParam as TabKey)
      : "details";

  const tabs = [
    { name: "Details", key: "details" },
    { name: "Earnings", key: "earnings" },
    { name: "Transactions", key: "transactions" },
  ];
  if (agentVerificationUiEnabled) {
    tabs.push({ name: "Verification", key: "verification" });
  }

  return (
    <div className="w-full space-y-4">
      {/* Header + Tabs - matches AgentPageHeader structure */}
      <div className="flex flex-col gap-8 pb-3 pt-1">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <Skeleton className="h-8 w-48 sm:w-64" />
            <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
          </div>
        </div>

        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={() => {}}
          className="pointer-events-none"
        />
      </div>

      {/* Tab-specific content skeleton */}
      <TabSkeleton tab={activeTab} />
    </div>
  );
}
