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
import type { RegistryEntryFilter } from "@/lib/api/registry-discovery.client";

const FILTER_DEFAULT = "online";

export type DiscoveryStatusFilter =
  | "online"
  | "all"
  | "offline"
  | "deregistered"
  | "invalid";

export type DiscoveryListFilters = {
  status?: DiscoveryStatusFilter;
};

export function countDiscoveryListFilters(
  filters: DiscoveryListFilters,
): number {
  return filters.status && filters.status !== FILTER_DEFAULT ? 1 : 0;
}

export function discoveryListFiltersToApi(
  filters: DiscoveryListFilters,
): RegistryEntryFilter {
  const status = filters.status ?? FILTER_DEFAULT;

  if (status === "all") {
    return {};
  }

  const statusMap = {
    online: "Online",
    offline: "Offline",
    deregistered: "Deregistered",
    invalid: "Invalid",
  } as const;

  return { status: [statusMap[status]] };
}

export function AgentsDiscoveryFiltersPopover({
  filters,
  activeFilterCount,
  network,
  onChange,
  onClear,
}: {
  filters: DiscoveryListFilters;
  activeFilterCount: number;
  network: string;
  onChange: (next: DiscoveryListFilters) => void;
  onClear: () => void;
}) {
  const t = useTranslations("App.Agents.Discovery");
  const status = filters.status ?? FILTER_DEFAULT;

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
            <Label htmlFor="discovery-filter-status">{t("filterStatus")}</Label>
            <Select
              value={status}
              onValueChange={(value) =>
                onChange({
                  ...filters,
                  status: value as DiscoveryStatusFilter,
                })
              }
            >
              <SelectTrigger id="discovery-filter-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">{t("statusOnline")}</SelectItem>
                <SelectItem value="all">{t("allStatuses")}</SelectItem>
                <SelectItem value="offline">{t("statusOffline")}</SelectItem>
                <SelectItem value="deregistered">
                  {t("statusDeregistered")}
                </SelectItem>
                <SelectItem value="invalid">{t("statusInvalid")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {t("networkHint", { network })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
