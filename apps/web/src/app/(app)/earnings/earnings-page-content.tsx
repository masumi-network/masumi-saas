"use client";

import {
  CalendarRange,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Clock3,
  Receipt,
  RotateCcw,
  Search,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AgentIcon } from "@/components/agent-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RefreshButton } from "@/components/ui/refresh-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import {
  filterMeaningfulEarningsSeries,
  formatResolvedEarningsPeriodLabel,
  getDefaultCustomDates,
} from "@/lib/earnings/presentation";
import {
  type DashboardEarningsAmountUnit,
  formatDashboardEarningsTotal,
  formatUnitAmount,
  formatUnits,
} from "@/lib/payment-node/format";
import type { AgentAnalyticsRange } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type EarningsMetric = "income" | "refunded" | "pending";

type EarningsGranularity = "day" | "month";

type EarningsDisplayValue = {
  usdAmount: number;
  adaAmount: number;
  displayUnit: DashboardEarningsAmountUnit;
  displayAmount: number;
  hasMixedUnits: boolean;
};

type EarningsSeriesPoint = EarningsDisplayValue & {
  key: string;
  label: string;
  amount: number;
  units: Array<{ unit: string; amount: number }>;
  blockchainFees: number;
};

type EarningsSummary = EarningsDisplayValue & {
  units: Array<{ unit: string; amount: number }>;
  blockchainFees: number;
};

type EarningsResponseData = {
  agent: {
    id: string;
    name: string;
    icon: string | null;
    agentIdentifier: string | null;
    network: "Mainnet" | "Preprod";
  };
  period: {
    range: AgentAnalyticsRange;
    granularity: EarningsGranularity;
    startDate: string;
    endDate: string;
    periodStart: string | null;
    periodEnd: string | null;
    timeZone: string;
  };
  totalTransactions: number;
  displayUnit: DashboardEarningsAmountUnit;
  totals: Record<EarningsMetric, EarningsSummary>;
  series: Record<EarningsMetric, EarningsSeriesPoint[]>;
};

type EarningsApiResponse =
  | { success: true; data: EarningsResponseData }
  | { success: false; error: string };

type EarningsAgentOption = {
  id: string;
  name: string;
  icon: string | null;
  agentIdentifier: string;
  registrationState: string;
  network: "Mainnet" | "Preprod";
};

type EarningsAgentsApiResponse =
  | { success: true; data: EarningsAgentOption[] }
  | { success: false; error: string };

const RANGE_OPTIONS: AgentAnalyticsRange[] = [
  "7d",
  "30d",
  "90d",
  "all",
  "custom",
];

const DEFAULT_RANGE: AgentAnalyticsRange = "30d";
const CHART_WIDTH = 100;
const CHART_HEIGHT = 44;
const CHART_PADDING = 2;

function isValidRange(value: string | null): value is AgentAnalyticsRange {
  return value !== null && RANGE_OPTIONS.includes(value as AgentAnalyticsRange);
}

function isValidYmd(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function buildChartPaths(points: EarningsSeriesPoint[]): {
  areaPath: string;
  linePath: string;
} {
  if (points.length === 0) {
    const flatY = CHART_HEIGHT - CHART_PADDING;
    return {
      areaPath: `M 0 ${flatY} L ${CHART_WIDTH} ${flatY} L ${CHART_WIDTH} ${CHART_HEIGHT} L 0 ${CHART_HEIGHT} Z`,
      linePath: `M 0 ${flatY} L ${CHART_WIDTH} ${flatY}`,
    };
  }

  const amounts = points.map((point) => point.amount);
  const minAmount = Math.min(...amounts);
  const maxAmount = Math.max(...amounts);
  const range = maxAmount - minAmount || 1;
  const stepX =
    points.length > 1
      ? (CHART_WIDTH - 2 * CHART_PADDING) / (points.length - 1)
      : CHART_WIDTH - 2 * CHART_PADDING;

  const mappedPoints = points.map((point, index) => {
    const x = CHART_PADDING + index * stepX;
    const y =
      CHART_HEIGHT -
      CHART_PADDING -
      ((point.amount - minAmount) / range) * (CHART_HEIGHT - 2 * CHART_PADDING);
    return { x, y };
  });

  const lineParts = mappedPoints.map(
    (point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
  );
  let linePath = lineParts.join(" ");

  if (mappedPoints.length === 1) {
    const y = mappedPoints[0]!.y;
    linePath = `M ${CHART_PADDING} ${y} L ${CHART_WIDTH - CHART_PADDING} ${y}`;
  }

  const lastPoint = mappedPoints[mappedPoints.length - 1]!;
  const areaPath =
    mappedPoints.length === 1
      ? `M ${CHART_PADDING} ${lastPoint.y} L ${CHART_WIDTH - CHART_PADDING} ${lastPoint.y} L ${CHART_WIDTH - CHART_PADDING} ${CHART_HEIGHT} L ${CHART_PADDING} ${CHART_HEIGHT} Z`
      : `${linePath} L ${lastPoint.x} ${CHART_HEIGHT} L ${CHART_PADDING} ${CHART_HEIGHT} Z`;

  return { areaPath, linePath };
}

function metricTone(metric: EarningsMetric): {
  color: string;
  chipClassName: string;
  iconClassName: string;
} {
  switch (metric) {
    case "income":
      return {
        color: "hsl(var(--primary))",
        chipClassName:
          "border-primary/20 bg-primary/10 text-primary hover:bg-primary/15",
        iconClassName: "text-primary",
      };
    case "refunded":
      return {
        color: "#f59e0b",
        chipClassName:
          "border-amber-400/30 bg-amber-400/10 text-amber-700 hover:bg-amber-400/15 dark:text-amber-200",
        iconClassName: "text-amber-600 dark:text-amber-300",
      };
    case "pending":
      return {
        color: "#38bdf8",
        chipClassName:
          "border-sky-400/30 bg-sky-400/10 text-sky-700 hover:bg-sky-400/15 dark:text-sky-200",
        iconClassName: "text-sky-600 dark:text-sky-300",
      };
  }
}

function metricIcon(metric: EarningsMetric) {
  switch (metric) {
    case "income":
      return TrendingUp;
    case "refunded":
      return RotateCcw;
    case "pending":
      return Clock3;
  }
}

function buildTableRows(points: EarningsSeriesPoint[]): EarningsSeriesPoint[] {
  return [...points].reverse();
}

function hasDisplayAmount(
  value: Pick<EarningsDisplayValue, "usdAmount" | "adaAmount">,
) {
  return value.usdAmount > 0 || value.adaAmount > 0;
}

function formatDisplayValue(
  value: EarningsDisplayValue,
  zeroUnit: DashboardEarningsAmountUnit = value.displayUnit,
): string {
  if (!hasDisplayAmount(value)) {
    return formatDashboardEarningsTotal(0, zeroUnit);
  }

  if (value.hasMixedUnits) {
    const parts: string[] = [];

    if (value.usdAmount > 0) {
      parts.push(formatDashboardEarningsTotal(value.usdAmount, "USD"));
    }
    if (value.adaAmount > 0) {
      parts.push(formatDashboardEarningsTotal(value.adaAmount, "ADA"));
    }

    if (parts.length > 0) {
      return parts.join(" + ");
    }
  }

  return formatDashboardEarningsTotal(value.displayAmount, value.displayUnit);
}

function resolveChartUnit(
  points: EarningsSeriesPoint[],
): DashboardEarningsAmountUnit | null {
  let unit: DashboardEarningsAmountUnit | null = null;

  for (const point of points) {
    if (point.hasMixedUnits) {
      return null;
    }
    if (!hasDisplayAmount(point)) {
      continue;
    }
    if (unit === null) {
      unit = point.displayUnit;
      continue;
    }
    if (unit !== point.displayUnit) {
      return null;
    }
  }

  return unit;
}

async function fetchEligibleAgents(
  network: "Mainnet" | "Preprod",
): Promise<EarningsAgentOption[]> {
  const response = await fetch(`/api/earnings/agents?network=${network}`);
  const json = (await response.json()) as EarningsAgentsApiResponse;

  if (!response.ok || !json.success) {
    throw new Error(json.success ? "Failed to load agents" : json.error);
  }

  return json.data;
}

function EarningsCardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card
          key={index}
          className="overflow-hidden border-border/70 bg-card/90 shadow-sm"
        >
          <CardContent className="p-5">
            <div className="space-y-3 animate-pulse">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-8 w-32 rounded bg-muted" />
              <div className="h-3 w-20 rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function EarningsPageContent() {
  const t = useTranslations("App.Earnings");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { network } = usePaymentNetwork();
  const [agents, setAgents] = useState<EarningsAgentOption[]>([]);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedMetric, setSelectedMetric] =
    useState<EarningsMetric>("income");
  const [data, setData] = useState<EarningsResponseData | null>(null);
  const [dataKey, setDataKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rawRange = searchParams.get("range");
  const selectedRange = isValidRange(rawRange) ? rawRange : DEFAULT_RANGE;
  const rawAgentId = searchParams.get("agentId");
  const selectedAgentId = rawAgentId?.trim() || null;
  const selectedStartDate = isValidYmd(searchParams.get("startDate"))
    ? searchParams.get("startDate")
    : null;
  const selectedEndDate = isValidYmd(searchParams.get("endDate"))
    ? searchParams.get("endDate")
    : null;
  const browserTimeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Etc/UTC";
    } catch {
      return "Etc/UTC";
    }
  }, []);
  const defaultCustomDates = useMemo(
    () => getDefaultCustomDates(browserTimeZone),
    [browserTimeZone],
  );
  const [customStartDate, setCustomStartDate] = useState(
    defaultCustomDates.startDate,
  );
  const [customEndDate, setCustomEndDate] = useState(
    defaultCustomDates.endDate,
  );

  const updateSearch = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname);
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (selectedRange === "custom" && selectedStartDate && selectedEndDate) {
      setCustomStartDate(selectedStartDate);
      setCustomEndDate(selectedEndDate);
    }
  }, [selectedEndDate, selectedRange, selectedStartDate]);

  useEffect(() => {
    let cancelled = false;
    setAgentsLoading(true);
    setAgentsError(null);

    void (async () => {
      try {
        const nextAgents = await fetchEligibleAgents(network);
        if (cancelled) return;
        setAgents(nextAgents);
      } catch (loadError) {
        if (cancelled) return;
        setAgents([]);
        setAgentsError(
          loadError instanceof Error ? loadError.message : t("loadAgentsError"),
        );
      } finally {
        if (!cancelled) setAgentsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [network, refreshKey, t]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;

    if (!isValidRange(rawRange) && rawRange !== null) {
      params.set("range", DEFAULT_RANGE);
      params.delete("startDate");
      params.delete("endDate");
      changed = true;
    }

    if (selectedRange === "custom") {
      const customDatesValid =
        selectedStartDate &&
        selectedEndDate &&
        selectedStartDate.localeCompare(selectedEndDate) <= 0;

      if (!customDatesValid) {
        params.set("range", DEFAULT_RANGE);
        params.delete("startDate");
        params.delete("endDate");
        changed = true;
      }
    } else if (params.has("startDate") || params.has("endDate")) {
      params.delete("startDate");
      params.delete("endDate");
      changed = true;
    }

    if (!agentsLoading) {
      if (agents.length === 0) {
        if (params.has("agentId")) {
          params.delete("agentId");
          changed = true;
        }
      } else if (
        !selectedAgentId ||
        !agents.some((agent) => agent.id === selectedAgentId)
      ) {
        params.set("agentId", agents[0]!.id);
        changed = true;
      }
    }

    if (changed) {
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname);
    }
  }, [
    agents,
    agentsLoading,
    pathname,
    rawRange,
    router,
    searchParams,
    selectedAgentId,
    selectedEndDate,
    selectedRange,
    selectedStartDate,
  ]);

  const currentKey = useMemo(
    () =>
      [
        network,
        selectedAgentId ?? "",
        selectedRange,
        selectedStartDate ?? "",
        selectedEndDate ?? "",
      ].join(":"),
    [
      network,
      selectedAgentId,
      selectedRange,
      selectedStartDate,
      selectedEndDate,
    ],
  );

  useEffect(() => {
    const selectedAgentExists = agents.some(
      (agent) => agent.id === selectedAgentId,
    );
    const customRangeIncomplete =
      selectedRange === "custom" && (!selectedStartDate || !selectedEndDate);

    if (
      agentsLoading ||
      agents.length === 0 ||
      !selectedAgentId ||
      !selectedAgentExists ||
      customRangeIncomplete
    ) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({
      agentId: selectedAgentId,
      network,
      range: selectedRange,
      timeZone: browserTimeZone,
    });
    if (selectedRange === "custom" && selectedStartDate && selectedEndDate) {
      params.set("startDate", selectedStartDate);
      params.set("endDate", selectedEndDate);
    }

    void (async () => {
      try {
        const response = await fetch(
          `/api/earnings/agent?${params.toString()}`,
        );
        const json = (await response.json()) as EarningsApiResponse;

        if (cancelled) return;

        if (!response.ok || !json.success) {
          setError(json.success ? t("loadEarningsError") : json.error);
          return;
        }

        setData(json.data);
        setDataKey(currentKey);
      } catch (requestError) {
        if (cancelled) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : t("loadEarningsError"),
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    agents,
    agentsLoading,
    browserTimeZone,
    currentKey,
    network,
    selectedAgentId,
    selectedEndDate,
    selectedRange,
    selectedStartDate,
    t,
  ]);

  const selectedAgent =
    agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? null;
  const isDataForCurrentSelection = dataKey === currentKey;
  const visibleData = isDataForCurrentSelection ? data : null;
  const chartPoints = visibleData?.series[selectedMetric] ?? [];
  const chartMetric = visibleData?.totals[selectedMetric] ?? null;
  const chartHasMeaningfulData = chartPoints.some((point) =>
    hasDisplayAmount(point),
  );
  const breakdownRows = buildTableRows(
    filterMeaningfulEarningsSeries(chartPoints),
  );
  const chartCanRender =
    chartHasMeaningfulData && resolveChartUnit(chartPoints) !== null;
  const chartTone = metricTone(selectedMetric);
  const ChartMetricIcon = metricIcon(selectedMetric);

  const applyCustomRange = () => {
    if (
      !isValidYmd(customStartDate) ||
      !isValidYmd(customEndDate) ||
      customStartDate.localeCompare(customEndDate) > 0
    ) {
      return;
    }

    updateSearch({
      range: "custom",
      startDate: customStartDate,
      endDate: customEndDate,
    });
  };

  const handleRangeChange = (value: string) => {
    const range = isValidRange(value) ? value : DEFAULT_RANGE;

    if (range === "custom") {
      const nextStart =
        selectedStartDate ?? customStartDate ?? defaultCustomDates.startDate;
      const nextEnd =
        selectedEndDate ?? customEndDate ?? defaultCustomDates.endDate;
      setCustomStartDate(nextStart);
      setCustomEndDate(nextEnd);
      updateSearch({
        range,
        startDate: nextStart,
        endDate: nextEnd,
      });
      return;
    }

    updateSearch({
      range,
      startDate: null,
      endDate: null,
    });
  };

  const { areaPath, linePath } = buildChartPaths(
    chartCanRender ? chartPoints : [],
  );
  const metricTabs: EarningsMetric[] = ["income", "refunded", "pending"];

  if (agentsError && !agentsLoading) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="font-medium text-destructive">{agentsError}</p>
            <p className="text-sm text-muted-foreground">
              {t("loadAgentsHelp")}
            </p>
          </div>
          <RefreshButton
            onRefresh={() => setRefreshKey((value) => value + 1)}
            isRefreshing={agentsLoading}
            variant="with-text"
          />
        </CardContent>
      </Card>
    );
  }

  if (!agentsLoading && agents.length === 0) {
    return (
      <Card className="overflow-hidden gap-0 py-0">
        <CardHeader className="border-b border-border/50 bg-masumi-gradient px-6 py-6">
          <CardTitle className="text-base font-semibold">
            {t("emptyTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("emptyDescription")}
          </p>
          <Button asChild>
            <Link href="/ai-agents">{t("emptyCta")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden gap-0 py-0">
        <CardHeader className="border-b border-border/50 bg-masumi-gradient px-6 py-6">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold">
                {t("filtersTitle")}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("filtersDescription")}
              </p>
            </div>
            <span className="inline-flex w-fit items-center rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              {t(`network.${network.toLowerCase()}`)}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_auto]">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("agentLabel")}
              </label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full justify-between rounded-xl border-border/70 bg-background px-3 text-left"
                  >
                    {selectedAgent ? (
                      <span className="flex min-w-0 items-center gap-3">
                        <AgentIcon
                          icon={selectedAgent.icon}
                          name={selectedAgent.name}
                          className="size-7 rounded-lg"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {selectedAgent.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {selectedAgent.agentIdentifier ??
                              t("missingIdentifier")}
                          </span>
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {t("selectAgent")}
                      </span>
                    )}
                    <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[360px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t("searchAgentsPlaceholder")} />
                    <CommandList>
                      <CommandEmpty>{t("searchAgentsEmpty")}</CommandEmpty>
                      <CommandGroup>
                        {agents.map((agent) => (
                          <CommandItem
                            key={agent.id}
                            value={`${agent.name} ${agent.agentIdentifier ?? ""}`}
                            onSelect={() => {
                              updateSearch({ agentId: agent.id });
                              setPickerOpen(false);
                            }}
                            className="gap-3 px-3 py-2.5"
                          >
                            <AgentIcon
                              icon={agent.icon}
                              name={agent.name}
                              className="size-7 rounded-lg"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">
                                {agent.name}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {agent.agentIdentifier}
                              </div>
                            </div>
                            {selectedAgentId === agent.id && (
                              <Check className="size-4 text-primary" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("rangeLabel")}
              </label>
              <Select value={selectedRange} onValueChange={handleRangeChange}>
                <SelectTrigger className="h-11 rounded-xl border-border/70 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="7d">{t("range.7d")}</SelectItem>
                  <SelectItem value="30d">{t("range.30d")}</SelectItem>
                  <SelectItem value="90d">{t("range.90d")}</SelectItem>
                  <SelectItem value="all">{t("range.all")}</SelectItem>
                  <SelectItem value="custom">{t("range.custom")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <RefreshButton
                onRefresh={() => setRefreshKey((value) => value + 1)}
                isRefreshing={isLoading}
                variant="with-text"
                className="h-11 rounded-xl"
              />
            </div>
          </div>

          {selectedRange === "custom" && (
            <div className="grid gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("startDateLabel")}
                </label>
                <Input
                  type="date"
                  value={customStartDate}
                  max={customEndDate}
                  onChange={(event) => setCustomStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("endDateLabel")}
                </label>
                <Input
                  type="date"
                  value={customEndDate}
                  min={customStartDate}
                  onChange={(event) => setCustomEndDate(event.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="primary"
                  className="h-10 rounded-xl px-4"
                  onClick={applyCustomRange}
                  disabled={
                    !isValidYmd(customStartDate) ||
                    !isValidYmd(customEndDate) ||
                    customStartDate.localeCompare(customEndDate) > 0
                  }
                >
                  <CalendarRange className="size-4" />
                  {t("applyCustomRange")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {error && visibleData && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <p className="text-destructive">{error}</p>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0 text-sm"
            onClick={() => setRefreshKey((value) => value + 1)}
          >
            {t("tryAgain")}
          </Button>
        </div>
      )}

      {!visibleData ? (
        error ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <Search className="size-8 text-destructive" />
              <div className="space-y-1">
                <p className="font-medium text-destructive">{error}</p>
                <p className="text-sm text-muted-foreground">
                  {t("loadEarningsHelp")}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRefreshKey((value) => value + 1)}
              >
                {t("tryAgain")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <EarningsCardSkeleton />
            <Card className="overflow-hidden gap-0 py-0">
              <CardHeader className="border-b border-border/50 bg-masumi-gradient px-6 py-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2 animate-pulse">
                    <div className="h-5 w-40 rounded bg-muted" />
                    <div className="h-4 w-56 rounded bg-muted" />
                  </div>
                  <div className="h-9 w-44 rounded-full bg-muted animate-pulse" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="h-64 rounded-2xl border border-border/70 bg-muted/20 animate-pulse" />
                <div className="h-56 rounded-2xl border border-border/70 bg-muted/20 animate-pulse" />
              </CardContent>
            </Card>
          </>
        )
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(
              [
                ["income", t("cards.income")],
                ["refunded", t("cards.refunded")],
                ["pending", t("cards.pending")],
                ["transactions", t("cards.transactions")],
              ] as const
            ).map(([metricKey, label]) => {
              const summary =
                metricKey === "transactions"
                  ? null
                  : visibleData.totals[metricKey as EarningsMetric];

              const tone =
                metricKey === "transactions"
                  ? {
                      chipClassName:
                        "border-border/70 bg-muted/30 text-muted-foreground",
                      iconClassName: "text-muted-foreground",
                    }
                  : metricTone(metricKey as EarningsMetric);

              const Icon =
                metricKey === "transactions"
                  ? Receipt
                  : metricIcon(metricKey as EarningsMetric);

              return (
                <Card
                  key={metricKey}
                  className="overflow-hidden border-border/70 bg-card/90 shadow-sm"
                >
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={cn(
                          "inline-flex size-10 items-center justify-center rounded-2xl border",
                          tone.chipClassName,
                        )}
                      >
                        <Icon className={cn("size-4", tone.iconClassName)} />
                      </span>
                      {metricKey !== "transactions" && summary && (
                        <span className="text-xs font-medium text-muted-foreground">
                          {formatUnitAmount("", summary.blockchainFees)}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {label}
                      </div>
                      <div className="font-mono text-2xl font-semibold tracking-tight">
                        {metricKey === "transactions"
                          ? visibleData.totalTransactions.toLocaleString(
                              "en-US",
                            )
                          : summary
                            ? formatDisplayValue(summary)
                            : formatDisplayValue({
                                usdAmount: 0,
                                adaAmount: 0,
                                displayUnit: "USD",
                                displayAmount: 0,
                                hasMixedUnits: false,
                              })}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {metricKey === "transactions"
                          ? t("transactionsHint")
                          : formatUnits(summary?.units ?? [])}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="overflow-hidden gap-0 py-0">
            <CardHeader className="border-b border-border/50 bg-masumi-gradient px-6 py-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <AgentIcon
                    icon={visibleData.agent.icon}
                    name={visibleData.agent.name}
                    className="size-10 rounded-2xl"
                  />
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base font-semibold">
                      {visibleData.agent.name}
                    </CardTitle>
                    <p className="truncate text-sm text-muted-foreground">
                      {visibleData.agent.agentIdentifier ??
                        t("missingIdentifier")}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {metricTabs.map((metric) => {
                    const tone = metricTone(metric);
                    const Icon = metricIcon(metric);
                    return (
                      <Button
                        key={metric}
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          "rounded-full border-border/70 bg-background/80 px-3 backdrop-blur",
                          selectedMetric === metric && tone.chipClassName,
                        )}
                        onClick={() => setSelectedMetric(metric)}
                      >
                        <Icon
                          className={cn(
                            "size-4",
                            selectedMetric === metric
                              ? tone.iconClassName
                              : "text-muted-foreground",
                          )}
                        />
                        {t(`metric.${metric}`)}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>
                  {formatResolvedEarningsPeriodLabel(visibleData.period)}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-xs">
                  <ChevronDown className="size-3 rotate-[-90deg]" />
                  {t(`granularity.${visibleData.period.granularity}`)}
                </span>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 p-6">
              <div className="rounded-3xl border border-border/70 bg-background/80 p-5 shadow-sm">
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {t(`metric.${selectedMetric}`)}
                    </p>
                    <p className="font-mono text-3xl font-semibold tracking-tight">
                      {chartMetric
                        ? formatDisplayValue(chartMetric)
                        : formatDisplayValue({
                            usdAmount: 0,
                            adaAmount: 0,
                            displayUnit: "USD",
                            displayAmount: 0,
                            hasMixedUnits: false,
                          })}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatUnits(chartMetric?.units ?? [])}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("feesLabel", {
                      fees: formatUnitAmount(
                        "",
                        chartMetric?.blockchainFees ?? 0,
                      ),
                    })}
                  </div>
                </div>

                {chartCanRender ? (
                  <div className="space-y-4">
                    <div className="h-64 w-full rounded-2xl border border-border/60 bg-gradient-to-b from-muted/30 to-background px-4 py-5">
                      <svg
                        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                        preserveAspectRatio="none"
                        className="h-full w-full"
                      >
                        <defs>
                          <linearGradient
                            id={`earnings-chart-gradient-${selectedMetric}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={chartTone.color}
                              stopOpacity="0.35"
                            />
                            <stop
                              offset="100%"
                              stopColor={chartTone.color}
                              stopOpacity="0"
                            />
                          </linearGradient>
                        </defs>
                        <path
                          d={areaPath}
                          fill={`url(#earnings-chart-gradient-${selectedMetric})`}
                        />
                        <path
                          d={linePath}
                          fill="none"
                          stroke={chartTone.color}
                          strokeWidth="0.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>{chartPoints[0]?.label}</span>
                      <span>
                        {chartPoints[Math.floor(chartPoints.length / 2)]?.label}
                      </span>
                      <span>{chartPoints[chartPoints.length - 1]?.label}</span>
                    </div>
                  </div>
                ) : chartHasMeaningfulData ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 py-16 text-center">
                    <ChartMetricIcon className="size-8 text-muted-foreground" />
                    <div className="space-y-1">
                      <p className="font-medium">{t("mixedUnitsTitle")}</p>
                      <p className="max-w-xl text-sm text-muted-foreground">
                        {t("mixedUnitsDescription")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 py-16 text-center">
                    <TrendingUp className="size-8 text-muted-foreground" />
                    <div className="space-y-1">
                      <p className="font-medium">{t("noDataTitle")}</p>
                      <p className="max-w-xl text-sm text-muted-foreground">
                        {t("noDataDescription")}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-border/70 bg-background/80 shadow-sm">
                <div className="border-b border-border/60 px-5 py-4">
                  <p className="text-sm font-semibold">
                    {t("breakdownTitle", {
                      metric: t(`metric.${selectedMetric}`),
                    })}
                  </p>
                </div>
                {breakdownRows.length === 0 ? (
                  <div className="px-5 py-10 text-sm text-muted-foreground">
                    {t("breakdownEmpty")}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("table.period")}</TableHead>
                        <TableHead>{t("table.amount")}</TableHead>
                        <TableHead>{t("table.fees")}</TableHead>
                        <TableHead>{t("table.raw")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {breakdownRows.map((point) => (
                        <TableRow key={point.key}>
                          <TableCell className="font-medium">
                            {point.label}
                          </TableCell>
                          <TableCell className="font-mono">
                            {formatDisplayValue(
                              point,
                              chartMetric && !chartMetric.hasMixedUnits
                                ? chartMetric.displayUnit
                                : point.displayUnit,
                            )}
                          </TableCell>
                          <TableCell>
                            {formatUnitAmount("", point.blockchainFees)}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-muted-foreground">
                            {formatUnits(point.units)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
