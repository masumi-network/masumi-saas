"use client";

import { ArrowDownLeft, RotateCcw, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshButton } from "@/components/ui/refresh-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Agent } from "@/lib/api/agent.client";
import { formatEarningsAsUsd } from "@/lib/payment-node/format";

import { TabSkeleton } from "../agent-tab-skeletons";

type TimePeriod = "1d" | "7d" | "30d" | "all";

interface AgentEarningsProps {
  agent: Agent;
}

type EarningsData = {
  totalTransactions: number;
  totalIncome: {
    units: Array<{ unit: string; amount: number }>;
    blockchainFees: number;
  };
  totalRefunded: {
    units: Array<{ unit: string; amount: number }>;
    blockchainFees: number;
  };
  totalPending: {
    units: Array<{ unit: string; amount: number }>;
    blockchainFees: number;
  };
  periodStart: string | null;
  periodEnd: string | null;
};

export function AgentEarnings({ agent }: AgentEarningsProps) {
  const t = useTranslations("App.Agents.Details.Earnings");
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("1d");
  const [refreshKey, setRefreshKey] = useState(0);
  const [earningsData, setEarningsData] = useState<EarningsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEarnings = useCallback(() => {
    setError(null);
    setIsLoading(true);
    fetch(`/api/agents/${agent.id}/earnings?period=${selectedPeriod}`)
      .then((res) => res.json())
      .then(
        (json: { success: boolean; data?: EarningsData; error?: string }) => {
          if (json.success && json.data) {
            setEarningsData(json.data);
          } else {
            setEarningsData(null);
            if (!json.success && json.error) setError(json.error);
          }
        },
      )
      .catch((err) => {
        setEarningsData(null);
        setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => setIsLoading(false));
  }, [agent.id, selectedPeriod]);

  useEffect(() => {
    queueMicrotask(() => fetchEarnings());
  }, [fetchEarnings, refreshKey]);

  if (isLoading && !earningsData) {
    return <TabSkeleton tab="earnings" />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm font-medium text-destructive">{error}</p>
        <button
          type="button"
          className="mt-3 text-sm font-medium text-primary underline-offset-4 hover:underline"
          onClick={() => {
            setError(null);
            setEarningsData(null);
            setRefreshKey((k) => k + 1);
          }}
        >
          {t("tryAgain")}
        </button>
      </div>
    );
  }

  const incomeFormatted = formatEarningsAsUsd(
    earningsData?.totalIncome?.units ?? [],
  );
  const refundedFormatted = formatEarningsAsUsd(
    earningsData?.totalRefunded?.units ?? [],
  );
  const txCount = earningsData?.totalTransactions ?? 0;
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Card className="overflow-hidden gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border/50 bg-masumi-gradient rounded-t-xl pt-6 p-6">
          <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </span>
            {t("title")}
          </CardTitle>
          <div className="flex items-center gap-2">
            <RefreshButton
              onRefresh={() => setRefreshKey((k) => k + 1)}
              isRefreshing={isLoading}
              size="sm"
              variant="icon-only"
            />
            <Select
              value={selectedPeriod}
              onValueChange={(value) => setSelectedPeriod(value as TimePeriod)}
            >
              <SelectTrigger className="w-42">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="1d">{t("period1d")}</SelectItem>
                <SelectItem value="7d">{t("period7d")}</SelectItem>
                <SelectItem value="30d">{t("period30d")}</SelectItem>
                <SelectItem value="all">{t("periodAll")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 fill-mode-both delay-0">
              <Card className="h-full gap-2 rounded-xl border border-border/80 py-4 shadow-sm">
                <CardHeader className="space-y-0 px-4 pb-0 pt-0">
                  <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <ArrowDownLeft className="h-3.5 w-3.5 shrink-0" />
                    {t("totalIncome")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-1">
                  <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
                    {incomeFormatted || "—"}
                  </span>
                </CardContent>
              </Card>
            </div>
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 fill-mode-both delay-75">
              <Card className="h-full gap-2 rounded-xl border border-border/80 py-4 shadow-sm">
                <CardHeader className="space-y-0 px-4 pb-0 pt-0">
                  <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                    {t("totalRefunded")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-1">
                  <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
                    {refundedFormatted || "—"}
                  </span>
                </CardContent>
              </Card>
            </div>
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 fill-mode-both delay-150">
              <Card className="h-full gap-2 rounded-xl border border-border/80 py-4 shadow-sm">
                <CardHeader className="space-y-0 px-4 pb-0 pt-0">
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    {t("transactions")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-1">
                  <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
                    {txCount}
                  </span>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
