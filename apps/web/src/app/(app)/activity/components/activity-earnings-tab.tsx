"use client";

import { TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";

export function ActivityEarningsTab() {
  const t = useTranslations("App.Activity");
  const [data, setData] = useState<{
    earnings: Array<{ date: string; amount: number }>;
    total: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setError(null);
    setIsLoading(true);
    fetch("/api/earnings?period=7d")
      .then((res) => res.json())
      .then(
        (json: {
          success: boolean;
          data?: {
            earnings: Array<{ date: string; amount: number }>;
            total: number;
          };
          error?: string;
        }) => {
          if (json.success && json.data) {
            setData({
              earnings: json.data.earnings ?? [],
              total: json.data.total ?? 0,
            });
          } else {
            setData(null);
            if (!json.success && json.error) setError(json.error);
          }
        },
      )
      .catch((err) => {
        setData(null);
        setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    queueMicrotask(() => refetch());
  }, [refetch]);

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button
          type="button"
          className="mt-2 text-sm text-primary underline-offset-4 hover:underline"
          onClick={refetch}
        >
          {t("tryAgain")}
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="mt-2 h-8 w-24" />
        <Skeleton className="mt-1 h-3 w-20" />
      </div>
    );
  }

  const total = data?.total ?? 0;
  const hasEarnings = total > 0 || (data?.earnings?.length ?? 0) > 0;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-2 text-muted-foreground">
        <TrendingUp className="size-5" />
        <span className="text-sm font-medium">{t("earningsSummary")}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold">
        {hasEarnings ? `${total.toFixed(2)}` : "0"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("earningsPeriod")}
      </p>
      {!hasEarnings && (
        <p className="mt-4 text-sm text-muted-foreground">{t("noEarnings")}</p>
      )}
    </div>
  );
}
