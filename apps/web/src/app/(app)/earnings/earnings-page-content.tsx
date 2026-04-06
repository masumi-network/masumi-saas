"use client";

import { Coins, DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import gridSvg from "@/assets/grid.svg";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import { EARNINGS_TIME_SERIES_CHART_ENABLED } from "@/lib/earnings/time-series-chart-enabled";
import {
  type DashboardEarningsAmountUnit,
  formatDashboardEarningsTotal,
} from "@/lib/payment-node/format";

import { EarningsChart } from "./earnings-chart";
import { EarningsWithdrawDialog } from "./earnings-withdraw-dialog";

const EARNINGS_PERIOD_STORAGE_KEY = "masumi_earnings_period";

/** Placeholder USD figures until withdrawal balances are loaded from an API. */
const PLACEHOLDER_WITHDRAW_USD = {
  totalWithdrawn: 12_450.67,
  availableForWithdrawals: 3_204.5,
  pendingWithdrawals: 156,
} as const;

type TimePeriod = "24h" | "7d" | "30d" | "all";

type EarningsPoint = { date: string; amount: number };

function getValidPeriod(value: string | null): TimePeriod | null {
  if (value === "24h" || value === "7d" || value === "30d" || value === "all") {
    return value;
  }
  return null;
}

function persistPeriodToStorage(period: TimePeriod) {
  try {
    localStorage.setItem(EARNINGS_PERIOD_STORAGE_KEY, period);
  } catch {
    /* quota / private mode */
  }
}

export function EarningsPageContent() {
  const t = useTranslations("App.Earnings");
  const tDash = useTranslations("App.Home.Dashboard.stats");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { network } = usePaymentNetwork();

  const [period, setPeriod] = useState<TimePeriod>(() => {
    const fromUrl = getValidPeriod(searchParams.get("period"));
    return fromUrl ?? "7d";
  });
  const [earnings, setEarnings] = useState<EarningsPoint[]>([]);
  const [total, setTotal] = useState(0);
  const [amountUnit, setAmountUnit] =
    useState<DashboardEarningsAmountUnit>("USD");
  const [previousTotal, setPreviousTotal] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const withdrawHref = useMemo(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("period", period);
    next.set("action", "withdraw");
    const q = next.toString();
    return pathname === "/earnings" ? `?${q}` : `/earnings?${q}`;
  }, [pathname, period, searchParams]);

  const withdrawOpen = searchParams.get("action") === "withdraw";

  const closeWithdrawDialog = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("action");
    if (!getValidPeriod(next.get("period"))) {
      next.set("period", period);
    }
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, period, router, searchParams]);

  const onWithdrawOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closeWithdrawDialog();
      }
    },
    [closeWithdrawDialog],
  );

  const fetchEarnings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/earnings?period=${period}&network=${network}`,
      );
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? t("loadError"));
        setEarnings([]);
        setTotal(0);
        setAmountUnit("USD");
        setPreviousTotal(undefined);
        return;
      }
      setEarnings(json.data.earnings ?? []);
      setTotal(json.data.total ?? 0);
      setAmountUnit(json.data.amountUnit ?? "USD");
      setPreviousTotal(json.data.previousTotal);
    } catch {
      setError(t("loadError"));
      setEarnings([]);
      setTotal(0);
      setAmountUnit("USD");
      setPreviousTotal(undefined);
    } finally {
      setIsLoading(false);
    }
  }, [period, network, t]);

  useEffect(() => {
    const urlPeriod = getValidPeriod(searchParams.get("period"));
    if (urlPeriod) {
      persistPeriodToStorage(urlPeriod);
      setPeriod((prev) => (prev === urlPeriod ? prev : urlPeriod));
      return;
    }

    let stored: TimePeriod | null = null;
    try {
      stored = getValidPeriod(
        localStorage.getItem(EARNINGS_PERIOD_STORAGE_KEY),
      );
    } catch {
      /* ignore */
    }
    if (stored) {
      setPeriod((prev) => (prev === stored ? prev : stored));
      const next = new URLSearchParams(searchParams.toString());
      next.set("period", stored);
      router.replace(
        next.toString() ? `${pathname}?${next.toString()}` : pathname,
        { scroll: false },
      );
    }
  }, [pathname, router, searchParams]);

  const onPeriodChange = useCallback(
    (p: TimePeriod) => {
      setPeriod(p);
      persistPeriodToStorage(p);
      const next = new URLSearchParams(searchParams.toString());
      next.set("period", p);
      router.replace(
        next.toString() ? `${pathname}?${next.toString()}` : pathname,
        { scroll: false },
      );
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  return (
    <div className="space-y-8">
      <EarningsWithdrawDialog
        open={withdrawOpen}
        onOpenChange={onWithdrawOpenChange}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground max-w-prose text-sm leading-6">
            {t("description")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm whitespace-nowrap">
            {t("periodPrefix")}
          </span>
          <Select
            value={period}
            onValueChange={(v) => onPeriodChange(v as TimePeriod)}
          >
            <SelectTrigger className="w-[140px]" aria-label={t("periodLabel")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="24h">{tDash("period24h")}</SelectItem>
              <SelectItem value="7d">{tDash("period7d")}</SelectItem>
              <SelectItem value="30d">{tDash("period30d")}</SelectItem>
              <SelectItem value="all">{tDash("periodAll")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <Card className="order-2 overflow-hidden gap-0 py-0 lg:order-1">
            <CardHeader className="rounded-t-xl border-b border-border/50 bg-masumi-gradient pt-6 pb-3 gap-1.5">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                {amountUnit === "USD" ? (
                  <DollarSign className="text-primary h-6 w-6 p-0.5 shrink-0 border-2 border-primary rounded-full" />
                ) : (
                  <Coins className="text-primary h-6 w-6 p-0.5 shrink-0 border-2 border-primary rounded-full" />
                )}
                {t("chartTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative overflow-hidden pt-6">
              <div
                className="pointer-events-none absolute inset-0 opacity-35 animate-grid-glide"
                aria-hidden
                style={{
                  backgroundImage: `url(${typeof gridSvg === "string" ? gridSvg : gridSvg.src || gridSvg})`,
                  backgroundRepeat: "repeat",
                  backgroundSize: "auto",
                  backgroundPosition: "center",
                }}
              />
              <div className="relative z-10">
                {isLoading ? (
                  <div
                    className="bg-muted/30 flex h-[min(22rem,55vh)] min-h-[240px] w-full animate-pulse rounded-md"
                    aria-hidden
                  />
                ) : !EARNINGS_TIME_SERIES_CHART_ENABLED ? (
                  <p className="text-muted-foreground flex min-h-[min(22rem,55vh)] items-center justify-center px-4 py-12 text-center text-sm leading-6">
                    {t("chartPaused")}
                  </p>
                ) : earnings.length === 0 ? (
                  <p className="text-muted-foreground flex min-h-[min(22rem,55vh)] items-center justify-center py-12 text-center text-sm">
                    {t("noData")}
                  </p>
                ) : (
                  <EarningsChart data={earnings} amountUnit={amountUnit} />
                )}
              </div>
            </CardContent>
          </Card>

          <div className="order-1 space-y-4 lg:order-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  {t("totalLabel")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight animate-pulse">
                    {formatDashboardEarningsTotal(0, amountUnit)}
                  </p>
                ) : (
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight">
                      {formatDashboardEarningsTotal(total, amountUnit)}
                    </p>
                    {previousTotal !== undefined &&
                      previousTotal > 0 &&
                      total !== previousTotal && (
                        <span
                          className={
                            total >= previousTotal
                              ? "flex items-center gap-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                              : "text-destructive/90 flex items-center gap-0.5 text-xs font-medium"
                          }
                        >
                          {total >= previousTotal ? (
                            <TrendingUp className="h-3.5 w-3.5" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5" />
                          )}
                          {tDash("percentValue", {
                            value: Math.abs(
                              Math.round(
                                ((total - previousTotal) / previousTotal) * 100,
                              ),
                            ),
                          })}{" "}
                          {tDash("vsPreviousPeriod")}
                        </span>
                      )}
                  </div>
                )}
                <p className="text-muted-foreground mt-2 text-xs">
                  {tDash("earningsDescription")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  {t("withdrawCardTitle")}
                </CardTitle>
              </CardHeader>
              <Separator className="-my-2" />
              <CardContent className="space-y-4 pt-0">
                <dl className="space-y-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                    <dt className="text-muted-foreground text-xs font-medium">
                      {t("totalWithdrawnLabel")}
                    </dt>
                    <dd className="font-mono text-lg font-semibold tabular-nums tracking-tight sm:text-right">
                      {formatDashboardEarningsTotal(
                        PLACEHOLDER_WITHDRAW_USD.totalWithdrawn,
                        "USD",
                      )}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                    <dt className="text-muted-foreground text-xs font-medium">
                      {t("availableForWithdrawalsLabel")}
                    </dt>
                    <dd className="font-mono text-lg font-semibold tabular-nums tracking-tight sm:text-right">
                      {formatDashboardEarningsTotal(
                        PLACEHOLDER_WITHDRAW_USD.availableForWithdrawals,
                        "USD",
                      )}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                    <dt className="text-muted-foreground text-xs font-medium">
                      {t("pendingWithdrawalsLabel")}
                    </dt>
                    <dd className="font-mono text-lg font-semibold tabular-nums tracking-tight sm:text-right">
                      {formatDashboardEarningsTotal(
                        PLACEHOLDER_WITHDRAW_USD.pendingWithdrawals,
                        "USD",
                      )}
                    </dd>
                  </div>
                </dl>
                <div className="flex flex-col gap-2">
                  <Button className="w-full" asChild variant="primary">
                    <Link href={withdrawHref} scroll={false}>
                      {t("goToWithdraw")}
                    </Link>
                  </Button>
                  <Button className="w-full" asChild variant="outline">
                    <Link href="/withdrawals">
                      {t("viewWithdrawalsHistory")}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
