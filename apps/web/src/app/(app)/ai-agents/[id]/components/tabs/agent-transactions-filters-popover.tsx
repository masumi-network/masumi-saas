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

import type { TransactionFilter } from "./agent-transactions-table";

export function countAgentTransactionFilters(
  filter: TransactionFilter,
): number {
  return filter === "all" ? 0 : 1;
}

export function AgentTransactionsFiltersPopover({
  filter,
  activeFilterCount,
  onFilterChange,
  onClear,
}: {
  filter: TransactionFilter;
  activeFilterCount: number;
  onFilterChange: (next: TransactionFilter) => void;
  onClear: () => void;
}) {
  const t = useTranslations("App.Agents.Details.Transactions");

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
            <Label htmlFor="agent-transactions-filter-type">
              {t("filterType")}
            </Label>
            <Select
              value={filter}
              onValueChange={(value) =>
                onFilterChange(value as TransactionFilter)
              }
            >
              <SelectTrigger
                id="agent-transactions-filter-type"
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filterAll")}</SelectItem>
                <SelectItem value="payments">{t("filterPayments")}</SelectItem>
                <SelectItem value="purchases">
                  {t("filterPurchases")}
                </SelectItem>
                <SelectItem value="refundRequests">
                  {t("filterRefundRequests")}
                </SelectItem>
                <SelectItem value="disputes">{t("filterDisputes")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
