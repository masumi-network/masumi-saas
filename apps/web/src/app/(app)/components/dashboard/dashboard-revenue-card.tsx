"use client";

import { Coins, DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
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
import { fetchEarningsForPeriod } from "@/lib/earnings/fetch-earnings-client";
import {
  type DashboardEarningsAmountUnit,
  earningsPercentChangeMagnitude,
  formatDashboardEarningsTotal,
} from "@/lib/payment-node/format";

type TimePeriod = "24h" | "7d" | "30d" | "all";

export function DashboardRevenueCard() {
  const t = useTranslations("App.Home.Dashboard.stats");
  const { network } = usePaymentNetwork();
  const [period, setPeriod] = useState<TimePeriod>("7d");
  const [total, setTotal] = useState(0);
  const [amountUnit, setAmountUnit] =
    useState<DashboardEarningsAmountUnit>("USD");
  const [previousTotal, setPreviousTotal] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEarnings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchEarningsForPeriod(period, network);
      if (!result.ok) {
        setError(result.error);
        setTotal(0);
        setAmountUnit("USD");
        setPreviousTotal(undefined);
        return;
      }
      setTotal(result.total);
      setAmountUnit(result.amountUnit);
      setPreviousTotal(result.previousTotal);
    } finally {
      setIsLoading(false);
    }
  }, [period, network]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  return (
    <Card className="group relative overflow-hidden rounded-xl border-l-4 border-l-primary pt-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
      <Link
        href={`/earnings?period=${period}`}
        className="absolute inset-0 z-[1] rounded-xl outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={t("earningsCardAria", {
          total: formatDashboardEarningsTotal(total, amountUnit),
        })}
      />
      <div className="relative z-[2] pointer-events-none">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 rounded-t-xl bg-masumi-gradient pb-2 pt-6">
          <CardTitle className="text-xs font-medium uppercase tracking-tight text-muted-foreground flex items-center gap-2 transition-colors group-hover:underline">
            {amountUnit === "USD" ? (
              <DollarSign className="h-4 w-4 shrink-0" />
            ) : (
              <Coins className="h-4 w-4 shrink-0" />
            )}
            {t("earnings")}
          </CardTitle>
          <div className="pointer-events-auto">
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
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="mb-1 text-sm text-destructive">{error}</p>
          ) : isLoading ? (
            <p className="mb-1 font-mono text-3xl font-semibold tabular-nums tracking-tight relative animate-pulse">
              {formatDashboardEarningsTotal(0, amountUnit)}
            </p>
          ) : (
            <div className="mb-1 flex flex-wrap items-baseline gap-2">
              <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight relative">
                {formatDashboardEarningsTotal(total, amountUnit)}
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
                    {t("percentValue", {
                      value: earningsPercentChangeMagnitude(
                        total,
                        previousTotal,
                      ),
                    })}{" "}
                    {t("vsPreviousPeriod")}
                  </span>
                )}
            </div>
          )}
          <p className="mb-4 text-xs text-muted-foreground">
            {t("earningsDescription")}
          </p>
        </CardContent>
      </div>
    </Card>
  );
}
