"use client";

import {
  ArrowRight,
  Coins,
  DollarSign,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import {
  type DashboardEarningsAmountUnit,
  formatDashboardEarningsTotal,
} from "@/lib/payment-node/format";

import { EarningsChart } from "./earnings-chart";
import { EarningsWithdrawDialog } from "./earnings-withdraw-dialog";

const WITHDRAW_QUERY = "action=withdraw";

type TimePeriod = "24h" | "7d" | "30d" | "all";

type EarningsPoint = { date: string; amount: number };

export function EarningsPageContent() {
  const t = useTranslations("App.Earnings");
  const tDash = useTranslations("App.Home.Dashboard.stats");
  const tDashHint = useTranslations("App.Home.Dashboard");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { network } = usePaymentNetwork();

  const withdrawHref = useMemo(
    () =>
      pathname === "/earnings"
        ? `?${WITHDRAW_QUERY}`
        : `/earnings?${WITHDRAW_QUERY}`,
    [pathname],
  );

  const withdrawOpen = searchParams.get("action") === "withdraw";

  const closeWithdrawDialog = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("action");
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const onWithdrawOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closeWithdrawDialog();
      }
    },
    [closeWithdrawDialog],
  );

  const [period, setPeriod] = useState<TimePeriod>("7d");
  const [earnings, setEarnings] = useState<EarningsPoint[]>([]);
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
          <p className="text-muted-foreground text-xs">
            {tDashHint("networkHint", { network })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={period}
            onValueChange={(v) => setPeriod(v as TimePeriod)}
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
          <Button variant="outline" asChild>
            <Link href={withdrawHref} scroll={false}>
              {t("goToWithdraw")}
              <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/60 bg-masumi-gradient pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                {amountUnit === "USD" ? (
                  <DollarSign className="text-primary h-5 w-5 shrink-0" />
                ) : (
                  <Coins className="text-primary h-5 w-5 shrink-0" />
                )}
                {t("chartTitle")}
              </CardTitle>
              <p className="text-muted-foreground text-xs">{t("chartHint")}</p>
            </CardHeader>
            <CardContent className="pt-6">
              {isLoading ? (
                <div
                  className="bg-muted/30 flex h-[min(22rem,55vh)] min-h-[240px] w-full animate-pulse rounded-md"
                  aria-hidden
                />
              ) : earnings.length === 0 ? (
                <p className="text-muted-foreground py-12 text-center text-sm">
                  {t("noData")}
                </p>
              ) : (
                <EarningsChart data={earnings} amountUnit={amountUnit} />
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
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
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-sm">
                  {t("withdrawTeaser")}
                </p>
                <Button
                  className="mt-4 w-full sm:w-auto"
                  asChild
                  variant="secondary"
                >
                  <Link href={withdrawHref} scroll={false}>
                    {t("goToWithdraw")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
