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

import {
  type ActivitySection,
  type ActivityTransactionTypeFilter,
} from "../lib/activity-page-state";

export function ActivityFiltersPopover({
  section,
  transactionFilter,
  activeFilterCount,
  onTransactionFilterChange,
  onClear,
}: {
  section: ActivitySection;
  transactionFilter: ActivityTransactionTypeFilter;
  activeFilterCount: number;
  onTransactionFilterChange: (next: ActivityTransactionTypeFilter) => void;
  onClear: () => void;
}) {
  const t = useTranslations("App.Activity");
  const filtersDisabled = section === "lifecycle";

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
          {filtersDisabled ? (
            <p className="text-sm text-muted-foreground">
              {t("filtersLifecycleHint")}
            </p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="activity-filter-type">{t("filterType")}</Label>
              <Select
                value={transactionFilter}
                onValueChange={(value) =>
                  onTransactionFilterChange(
                    value as ActivityTransactionTypeFilter,
                  )
                }
              >
                <SelectTrigger id="activity-filter-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("filterTypeAll")}</SelectItem>
                  <SelectItem value="purchases">{t("tabPurchases")}</SelectItem>
                  <SelectItem value="payments">{t("tabPayments")}</SelectItem>
                  <SelectItem value="refundRequests">
                    {t("tabRefundRequests")}
                  </SelectItem>
                  <SelectItem value="disputes">{t("tabDisputes")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
