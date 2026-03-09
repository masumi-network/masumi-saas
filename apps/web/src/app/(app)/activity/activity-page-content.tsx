"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Tabs } from "@/components/ui/tabs";

import { ActivityAllFeed } from "./components/activity-all-feed";
import { ActivityEarningsTab } from "./components/activity-earnings-tab";
import { ActivityTransactionsTab } from "./components/activity-transactions-tab";

const TAB_KEYS = ["all", "transactions", "earnings"] as const;

export function ActivityPageContent() {
  const t = useTranslations("App.Activity");
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>("all");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && TAB_KEYS.includes(tab as (typeof TAB_KEYS)[number])) {
      queueMicrotask(() => setActiveTab(tab));
    }
  }, [searchParams]);

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    const url = new URL(window.location.href);
    if (value === "all") url.searchParams.delete("tab");
    else url.searchParams.set("tab", value);
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);

  const tabConfig = useMemo(
    () => [
      { key: "all", name: t("tabAll") },
      { key: "transactions", name: t("tabTransactions") },
      { key: "earnings", name: t("tabEarnings") },
    ],
    [t],
  );

  return (
    <div className="space-y-6">
      <Tabs
        tabs={tabConfig}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
      {activeTab === "all" && (
        <div className="mt-6">
          <ActivityAllFeed />
        </div>
      )}
      {activeTab === "transactions" && (
        <div className="mt-6">
          <ActivityTransactionsTab />
        </div>
      )}
      {activeTab === "earnings" && (
        <div className="mt-6">
          <ActivityEarningsTab />
        </div>
      )}
    </div>
  );
}
