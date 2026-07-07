"use client";

import { ListFilter } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InboxAgentFilterStatus } from "@/lib/api/inbox-agent.client";

const FILTER_ALL = "__all__";

export type InboxManageFilterKey =
  | "registered"
  | "deregistered"
  | "pending"
  | "failed";

export type InboxManageListFilters = {
  status?: InboxManageFilterKey;
};

export function countInboxManageListFilters(
  filters: InboxManageListFilters,
): number {
  return filters.status ? 1 : 0;
}

export function inboxManageListFiltersToApi(
  filters: InboxManageListFilters,
): InboxAgentFilterStatus | undefined {
  if (!filters.status) return undefined;

  const map: Record<InboxManageFilterKey, InboxAgentFilterStatus> = {
    registered: "Registered",
    deregistered: "Deregistered",
    pending: "Pending",
    failed: "Failed",
  };

  return map[filters.status];
}

export function parseInboxManageListFilters(
  searchParams: URLSearchParams,
): InboxManageListFilters {
  const legacyTab = searchParams.get("tab");
  if (legacyTab && legacyTab !== "all") {
    if (
      legacyTab === "registered" ||
      legacyTab === "deregistered" ||
      legacyTab === "pending" ||
      legacyTab === "failed"
    ) {
      return { status: legacyTab };
    }
  }

  const status = searchParams.get("status");
  if (
    status === "registered" ||
    status === "deregistered" ||
    status === "pending" ||
    status === "failed"
  ) {
    return { status };
  }

  return {};
}

export function inboxManageListFiltersToSearchParams(
  filters: InboxManageListFilters,
  base: URLSearchParams,
): URLSearchParams {
  const params = new URLSearchParams(base.toString());
  params.delete("tab");

  if (filters.status) {
    params.set("status", filters.status);
  } else {
    params.delete("status");
  }

  return params;
}

export function InboxAgentsFiltersPopover({
  filters,
  activeFilterCount,
  onChange,
  onClear,
}: {
  filters: InboxManageListFilters;
  activeFilterCount: number;
  onChange: (next: InboxManageListFilters) => void;
  onClear: () => void;
}) {
  const t = useTranslations("App.InboxAgents");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative h-9 w-9 shrink-0"
          aria-label={t("filtersAria")}
        >
          <ListFilter className="h-4 w-4" />
          {activeFilterCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 overflow-hidden rounded-xl border-border/80 p-0 shadow-lg"
        align="end"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">{t("filters")}</p>
          {activeFilterCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={onClear}
            >
              {t("clearFilters")}
            </Button>
          ) : null}
        </div>
        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="inbox-agents-filter-status">
              {t("filterStatus")}
            </Label>
            <Select
              value={filters.status ?? FILTER_ALL}
              onValueChange={(value) =>
                onChange({
                  ...filters,
                  status:
                    value === FILTER_ALL
                      ? undefined
                      : (value as InboxManageFilterKey),
                })
              }
            >
              <SelectTrigger id="inbox-agents-filter-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>{t("allStatuses")}</SelectItem>
                <SelectItem value="registered">
                  {t("tabs.registered")}
                </SelectItem>
                <SelectItem value="deregistered">
                  {t("tabs.deregistered")}
                </SelectItem>
                <SelectItem value="pending">{t("tabs.pending")}</SelectItem>
                <SelectItem value="failed">{t("tabs.failed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
