"use client";

import { CalendarRange, ListFilter } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { AgentAnalyticsRange } from "@/lib/schemas";

const RANGE_OPTIONS: AgentAnalyticsRange[] = [
  "7d",
  "30d",
  "90d",
  "all",
  "custom",
];

export const DEFAULT_EARNINGS_RANGE: AgentAnalyticsRange = "30d";

export function countEarningsFilters(range: AgentAnalyticsRange): number {
  return range === DEFAULT_EARNINGS_RANGE ? 0 : 1;
}

export function EarningsFiltersPopover({
  selectedRange,
  customStartDate,
  customEndDate,
  onRangeChange,
  onCustomStartDateChange,
  onCustomEndDateChange,
  onApplyCustomRange,
  onClear,
  canApplyCustomRange,
}: {
  selectedRange: AgentAnalyticsRange;
  customStartDate: string;
  customEndDate: string;
  onRangeChange: (range: AgentAnalyticsRange) => void;
  onCustomStartDateChange: (value: string) => void;
  onCustomEndDateChange: (value: string) => void;
  onApplyCustomRange: () => void;
  onClear: () => void;
  canApplyCustomRange: boolean;
}) {
  const t = useTranslations("App.Earnings");
  const activeFilterCount = countEarningsFilters(selectedRange);

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
            <Label htmlFor="earnings-filter-range">{t("rangeLabel")}</Label>
            <Select
              value={selectedRange}
              onValueChange={(value) => {
                if (RANGE_OPTIONS.includes(value as AgentAnalyticsRange)) {
                  onRangeChange(value as AgentAnalyticsRange);
                }
              }}
            >
              <SelectTrigger id="earnings-filter-range" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((range) => (
                  <SelectItem key={range} value={range}>
                    {t(`range.${range}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedRange === "custom" ? (
            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
              <div className="space-y-2">
                <Label htmlFor="earnings-filter-start">
                  {t("startDateLabel")}
                </Label>
                <Input
                  id="earnings-filter-start"
                  type="date"
                  value={customStartDate}
                  max={customEndDate}
                  onChange={(event) =>
                    onCustomStartDateChange(event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="earnings-filter-end">{t("endDateLabel")}</Label>
                <Input
                  id="earnings-filter-end"
                  type="date"
                  value={customEndDate}
                  min={customStartDate}
                  onChange={(event) =>
                    onCustomEndDateChange(event.target.value)
                  }
                />
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="w-full"
                onClick={onApplyCustomRange}
                disabled={!canApplyCustomRange}
              >
                <CalendarRange className="size-4" />
                {t("applyCustomRange")}
              </Button>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
