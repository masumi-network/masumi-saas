"use client";

import { useSearchParams } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";

import { type TabKey, TabSkeleton } from "./agent-tab-skeletons";

const VALID_TAB_KEYS: TabKey[] = [
  "details",
  "earnings",
  "transactions",
  "credentials",
];

export function AgentPageLoading() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: TabKey =
    tabParam && VALID_TAB_KEYS.includes(tabParam as TabKey)
      ? (tabParam as TabKey)
      : "details";

  const tabs = [
    { name: "Details", key: "details" },
    { name: "Earnings", key: "earnings" },
    { name: "Transactions", key: "transactions" },
    { name: "Credentials", key: "credentials" },
  ];

  return (
    <div className="w-full space-y-4">
      {/* Header + Tabs */}
      <div className="flex flex-col gap-12 pb-3 pt-1">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <Skeleton className="h-8 w-48 sm:w-64" />
          <Skeleton className="h-5 w-5 shrink-0 rounded" />
          <Skeleton className="ml-auto h-9 w-9 shrink-0 rounded-md" />
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
