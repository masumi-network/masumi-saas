"use client";

import { TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { type Agent } from "@/lib/api/agent.client";

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

function formatUnits(units: Array<{ unit: string; amount: number }>): string {
  if (!units.length) return "0";
  const ada = units.find((u) => u.unit === "");
  if (ada) {
    const lovelace = ada.amount;
    const adaNum = lovelace / 1_000_000;
    return adaNum.toFixed(6) + " ADA";
  }
  return units.map((u) => `${u.amount} ${u.unit.slice(0, 8)}`).join(", ");
}

export function AgentEarnings({ agent }: AgentEarningsProps) {
  const t = useTranslations("App.Agents.Details.Earnings");
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("1d");
  const [earningsData, setEarningsData] = useState<EarningsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setError(null);
      setIsLoading(true);
      fetch(`/api/agents/${agent.id}/earnings?period=${selectedPeriod}`)
        .then((res) => res.json())
        .then(
          (json: { success: boolean; data?: EarningsData; error?: string }) => {
            if (cancelled) return;
            if (json.success && json.data) {
              setEarningsData(json.data);
            } else {
              setEarningsData(null);
              if (!json.success && json.error) setError(json.error);
            }
          },
        )
        .catch((err) => {
          if (!cancelled) {
            setEarningsData(null);
            setError(err instanceof Error ? err.message : "Failed to load");
          }
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [agent.id, selectedPeriod]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <Spinner size={32} />
          <span className="text-sm font-medium text-muted-foreground">
            {t("loading")}
          </span>
        </div>
      </div>
    );
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
            setIsLoading(true);
            fetch(`/api/agents/${agent.id}/earnings?period=${selectedPeriod}`)
              .then((res) => res.json())
              .then(
                (json: {
                  success: boolean;
                  data?: EarningsData;
                  error?: string;
                }) => {
                  if (json.success && json.data) setEarningsData(json.data);
                  else if (!json.success && json.error) setError(json.error);
                },
              )
              .catch((err) =>
                setError(err instanceof Error ? err.message : "Failed to load"),
              )
              .finally(() => setIsLoading(false));
          }}
        >
          {t("tryAgain")}
        </button>
      </div>
    );
  }

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
        <CardContent className="p-6">
          {earningsData ? (
            <>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t("totalIncome")}
                  </span>
                  <span className="text-lg font-semibold">
                    {formatUnits(earningsData.totalIncome?.units ?? [])}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t("totalRefunded")}
                  </span>
                  <span className="text-lg font-semibold">
                    {formatUnits(earningsData.totalRefunded?.units ?? [])}
                  </span>
                </div>
              </div>
              <div className="flex justify-center pt-4">
                <Badge variant="secondary" className="font-medium">
                  {earningsData.totalTransactions ?? 0} {t("transactions")}
                </Badge>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                {t("noEarningsData")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
