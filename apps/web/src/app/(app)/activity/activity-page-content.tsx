"use client";

import { Download, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Tabs } from "@/components/ui/tabs";
import { useFormatDate } from "@/hooks/use-format-date";
import { useNewTransactionsCount } from "@/lib/hooks/useNewTransactionsCount";
import type { ActivityFeedItem } from "@/lib/types/activity";

import {
  ActivityFeedTable,
  type ActivityFeedTableHandle,
  LIFECYCLE_LABELS,
} from "./components/activity-all-feed";
import { ActivityFiltersPopover } from "./components/activity-filters-popover";
import {
  activityPageStateToSearchParams,
  type ActivitySection,
  type ActivityTransactionTypeFilter,
  countActivityFilters,
  parseActivityPageState,
  resolveActivityApiFilter,
} from "./lib/activity-page-state";

export function ActivityPageContent({
  linkAgentsInAdmin = false,
}: {
  linkAgentsInAdmin?: boolean;
}) {
  const t = useTranslations("App.Activity");
  const { formatDate } = useFormatDate();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pageState = useMemo(
    () => parseActivityPageState(searchParams),
    [searchParams],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasItemsToExport, setHasItemsToExport] = useState(false);
  const tableRef = useRef<ActivityFeedTableHandle>(null);
  const { markAllAsRead } = useNewTransactionsCount();

  const apiFilter = useMemo(
    () =>
      resolveActivityApiFilter(pageState.section, pageState.transactionFilter),
    [pageState.section, pageState.transactionFilter],
  );
  const activeFilterCount = useMemo(
    () => countActivityFilters(pageState.section, pageState.transactionFilter),
    [pageState.section, pageState.transactionFilter],
  );

  const pushPageState = useCallback(
    (
      section: ActivitySection,
      transactionFilter: ActivityTransactionTypeFilter,
    ) => {
      const params = activityPageStateToSearchParams(
        section,
        transactionFilter,
        searchParams,
      );
      const query = params.toString();
      router.replace(query ? `/activity?${query}` : "/activity");
    },
    [router, searchParams],
  );

  const handleFilteredItemsChange = useCallback((items: ActivityFeedItem[]) => {
    setHasItemsToExport(items.length > 0);
  }, []);

  useEffect(() => {
    markAllAsRead();
  }, [markAllAsRead]);

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

  const handleSectionChange = useCallback(
    (value: string) => {
      const section = value as ActivitySection;
      const transactionFilter =
        section === "lifecycle" ? "all" : pageState.transactionFilter;
      pushPageState(section, transactionFilter);
    },
    [pageState.transactionFilter, pushPageState],
  );

  const downloadCsv = useCallback(() => {
    const items = tableRef.current?.getFilteredItems() ?? [];
    const headers = [
      t("type"),
      t("transactionHash"),
      t("agentIdentifier"),
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
        item.agentIdentifier ?? "",
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
    link.download = `activity-${apiFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    const blobUrl = link.href;
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }, [t, apiFilter, formatDate]);

  const tabConfig = useMemo(
    () => [
      { key: "all", name: t("tabAll") },
      { key: "lifecycle", name: t("tabLifecycle") },
      { key: "transactions", name: t("tabTransactions") },
    ],
    [t],
  );

  return (
    <div className="min-w-0 space-y-4">
      <Tabs
        tabs={tabConfig}
        activeTab={pageState.section}
        onTabChange={handleSectionChange}
      />

      <div className="flex items-center gap-2 sm:gap-3">
        <div
          onClick={() => searchInputRef.current?.focus()}
          className="relative flex min-w-0 flex-1 cursor-text items-center gap-2 rounded-lg border border-border/80 bg-muted-surface/60 px-3 py-2.5 text-sm ring-offset-background transition-colors focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 md:max-w-md lg:max-w-sm"
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
            <kbd className="pointer-events-none hidden h-6 shrink-0 items-center justify-center rounded-md border bg-muted px-2 font-mono text-xs text-foreground sm:inline-flex">
              {t("searchShortcut")}
            </kbd>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ActivityFiltersPopover
            section={pageState.section}
            transactionFilter={pageState.transactionFilter}
            activeFilterCount={activeFilterCount}
            onTransactionFilterChange={(next) =>
              pushPageState(pageState.section, next)
            }
            onClear={() => pushPageState(pageState.section, "all")}
          />
          <RefreshButton
            onRefresh={() => setRefreshKey((k) => k + 1)}
            size="md"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 md:hidden"
            onClick={downloadCsv}
            disabled={!hasItemsToExport}
            aria-label={t("downloadCsv")}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="hidden h-9 items-center gap-2 md:flex"
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
        filter={apiFilter}
        searchQuery={searchQuery}
        refreshKey={refreshKey}
        onFilteredItemsChange={handleFilteredItemsChange}
        linkAgentsInAdmin={linkAgentsInAdmin}
      />
    </div>
  );
}
