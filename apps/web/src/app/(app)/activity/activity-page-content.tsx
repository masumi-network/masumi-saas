"use client";

import { Download, RefreshCw, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { useNewTransactionsCount } from "@/lib/hooks/useNewTransactionsCount";
import type { ActivityFeedItem } from "@/lib/types/activity";
import { formatDate } from "@/lib/utils";

import {
  ActivityFeedTable,
  type ActivityFeedTableHandle,
  type ActivityTabFilter,
  LIFECYCLE_LABELS,
} from "./components/activity-all-feed";

const TAB_KEYS: ActivityTabFilter[] = [
  "all",
  "lifecycle",
  "transactions",
  "purchases",
  "payments",
  "refundRequests",
  "disputes",
];

export function ActivityPageContent() {
  const t = useTranslations("App.Activity");
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<ActivityTabFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasItemsToExport, setHasItemsToExport] = useState(false);
  const tableRef = useRef<ActivityFeedTableHandle>(null);
  const { markAllAsRead } = useNewTransactionsCount();

  const handleFilteredItemsChange = useCallback((items: ActivityFeedItem[]) => {
    setHasItemsToExport(items.length > 0);
  }, []);

  useEffect(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  useEffect(() => {
    const tab = searchParams.get("tab") as ActivityTabFilter | null;
    if (tab && TAB_KEYS.includes(tab)) {
      queueMicrotask(() => setActiveTab(tab));
    }
  }, [searchParams]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "f" || e.ctrlKey || e.metaKey || e.altKey)
        return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as ActivityTabFilter);
    const url = new URL(window.location.href);
    if (value === "all") url.searchParams.delete("tab");
    else url.searchParams.set("tab", value);
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);

  const downloadCsv = useCallback(() => {
    const items = tableRef.current?.getFilteredItems() ?? [];
    const headers = [
      t("type"),
      t("transactionHash"),
      t("agent"),
      t("amount"),
      t("status"),
      t("date"),
    ];
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = items.map((item) => {
      if (item.kind === "lifecycle") {
        return [
          t("lifecycle"),
          "",
          item.agentName ?? "",
          "",
          LIFECYCLE_LABELS[item.type] ?? item.type,
          formatDate(item.date),
        ].map(escape);
      }
      return [
        item.type,
        item.txHash ?? "",
        item.agentName ?? "",
        item.amount,
        item.status.replace(/([A-Z])/g, " $1").trim(),
        formatDate(item.date),
      ].map(escape);
    });
    const csv = [
      headers.map(escape).join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `activity-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    const blobUrl = link.href;
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }, [t, activeTab]);

  const tabConfig = useMemo(
    () => [
      { key: "all", name: t("tabAll") },
      { key: "lifecycle", name: t("tabLifecycle") },
      { key: "transactions", name: t("tabTransactions") },
      { key: "purchases", name: t("tabPurchases") },
      { key: "payments", name: t("tabPayments") },
      { key: "refundRequests", name: t("tabRefundRequests") },
      { key: "disputes", name: t("tabDisputes") },
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
      <div className="flex flex-col gap-4 mt-6">
        <div className="flex items-center justify-between gap-4">
          <div
            onClick={() => searchInputRef.current?.focus()}
            className="flex w-full max-w-64 sm:max-w-80 cursor-text items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 shrink-0"
          >
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="search"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className="h-6 min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
            {!isSearchFocused && (
              <kbd className="hidden sm:inline-flex h-6 shrink-0 items-center justify-center rounded-md border bg-muted px-2 font-mono text-xs text-foreground pointer-events-none">
                {t("searchShortcut")}
              </kbd>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("refresh")}
              onClick={() => setRefreshKey((k) => k + 1)}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex items-center gap-2"
              onClick={downloadCsv}
              disabled={!hasItemsToExport}
              aria-label={t("downloadCsv")}
            >
              <Download className="h-4 w-4" />
              {t("downloadCsv")}
            </Button>
          </div>
        </div>
        <ActivityFeedTable
          ref={tableRef}
          filter={activeTab}
          searchQuery={searchQuery}
          refreshKey={refreshKey}
          onFilteredItemsChange={handleFilteredItemsChange}
        />
      </div>
    </div>
  );
}
