"use client";

import { DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";

type TimePeriod = "24h" | "7d" | "30d" | "all";

type EarningsPoint = { date: string; amount: number };

const CHART_WIDTH = 100;
const CHART_HEIGHT = 40;
const PADDING = 2;

function buildEarningsChartPaths(earnings: EarningsPoint[]): {
  areaPath: string;
  linePath: string;
} {
  if (earnings.length === 0) {
    const flatY = CHART_HEIGHT - PADDING;
    return {
      areaPath: `M 0 ${flatY} L ${CHART_WIDTH} ${flatY} L ${CHART_WIDTH} ${CHART_HEIGHT} L 0 ${CHART_HEIGHT} Z`,
      linePath: `M 0 ${flatY} L ${CHART_WIDTH} ${flatY}`,
    };
  }

  const amounts = earnings.map((p) => p.amount);
  const minAmount = Math.min(...amounts);
  const maxAmount = Math.max(...amounts);
  const range = maxAmount - minAmount || 1;
  const n = earnings.length;
  const stepX =
    n > 1 ? (CHART_WIDTH - 2 * PADDING) / (n - 1) : CHART_WIDTH - 2 * PADDING;

  const points: { x: number; y: number }[] = earnings.map((p, i) => {
    const x = PADDING + i * stepX;
    const y =
      CHART_HEIGHT -
      PADDING -
      ((p.amount - minAmount) / range) * (CHART_HEIGHT - 2 * PADDING);
    return { x, y };
  });

  const lineParts: string[] = [];
  for (let i = 0; i < points.length; i++) {
    const { x, y } = points[i];
    lineParts.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
  }
  let linePath = lineParts.join(" ");

  if (n === 1) {
    const { y } = points[0];
    linePath = `M ${PADDING} ${y} L ${CHART_WIDTH - PADDING} ${y}`;
  }

  const lastX = points[points.length - 1].x;
  const lastY = points[points.length - 1].y;
  const areaPath =
    n === 1
      ? `M ${PADDING} ${lastY} L ${CHART_WIDTH - PADDING} ${lastY} L ${CHART_WIDTH - PADDING} ${CHART_HEIGHT} L ${PADDING} ${CHART_HEIGHT} Z`
      : `${linePath} L ${lastX} ${CHART_HEIGHT} L ${PADDING} ${CHART_HEIGHT} Z`;

  return { areaPath, linePath };
}

function formatRevenue(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function DashboardRevenueCard() {
  const t = useTranslations("App.Home.Dashboard.stats");
  const { network } = usePaymentNetwork();
  const [period, setPeriod] = useState<TimePeriod>("7d");
  const [earnings, setEarnings] = useState<EarningsPoint[]>([]);
  const [total, setTotal] = useState(0);
  const [previousTotal, setPreviousTotal] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEarnings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/earnings?period=${period}&network=${network}`,
      );
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Failed to load earnings");
        setEarnings([]);
        setTotal(0);
        setPreviousTotal(undefined);
        return;
      }
      setEarnings(json.data.earnings ?? []);
      setTotal(json.data.total ?? 0);
      setPreviousTotal(json.data.previousTotal);
    } catch {
      setError("Failed to load earnings");
      setEarnings([]);
      setTotal(0);
      setPreviousTotal(undefined);
    } finally {
      setIsLoading(false);
    }
  }, [period, network]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  return (
    <Card
      className="group relative overflow-hidden rounded-xl pt-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
      role="group"
      aria-label={`${t("earnings")}: ${formatRevenue(total)}`}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 rounded-t-xl bg-masumi-gradient pb-2 pt-6">
        <CardTitle className="text-xs font-medium uppercase tracking-tight text-muted-foreground flex items-center gap-2">
          <DollarSign className="h-4 w-4 shrink-0" />
          {t("earnings")}
        </CardTitle>
        <Select
          value={period}
          onValueChange={(v) => setPeriod(v as TimePeriod)}
        >
          <SelectTrigger className="w-28 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="24h">{t("period24h")}</SelectItem>
            <SelectItem value="7d">{t("period7d")}</SelectItem>
            <SelectItem value="30d">{t("period30d")}</SelectItem>
            <SelectItem value="all">{t("periodAll")}</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="relative">
        {/* Line chart from earnings array - hide when no data */}
        {!isLoading && earnings.length > 0 && (
          <div
            className="absolute right-0 bottom-0 h-30 w-full pointer-events-none"
            aria-hidden
          >
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              preserveAspectRatio="none"
              className="w-full h-full opacity-60"
            >
              <defs>
                <linearGradient
                  id="earnings-chart-gradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity="0.4"
                  />
                  <stop
                    offset="100%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity="0"
                  />
                </linearGradient>
              </defs>
              {(() => {
                const { areaPath, linePath } =
                  buildEarningsChartPaths(earnings);
                return (
                  <>
                    <path d={areaPath} fill="url(#earnings-chart-gradient)" />
                    <path
                      d={linePath}
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="0.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </>
                );
              })()}
            </svg>
          </div>
        )}

        {error ? (
          <p className="mb-1 text-sm text-destructive">{error}</p>
        ) : isLoading ? (
          <p className="mb-1 font-mono text-3xl font-semibold tabular-nums tracking-tight relative animate-pulse">
            {formatRevenue(0)}
          </p>
        ) : (
          <div className="mb-1 flex flex-wrap items-baseline gap-2">
            <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight relative">
              {formatRevenue(total)}
            </p>
            {previousTotal !== undefined &&
              previousTotal > 0 &&
              total !== previousTotal && (
                <span
                  className={
                    total >= previousTotal
                      ? "text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-0.5"
                      : "text-destructive/90 text-xs font-medium flex items-center gap-0.5"
                  }
                >
                  {total >= previousTotal ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {Math.abs(
                    Math.round(((total - previousTotal) / previousTotal) * 100),
                  )}
                  {"% "}
                  {t("vsPreviousPeriod")}
                </span>
              )}
          </div>
        )}
        <p className="mb-4 text-xs text-muted-foreground">
          {t("earningsDescription")}
        </p>
      </CardContent>
    </Card>
  );
}
