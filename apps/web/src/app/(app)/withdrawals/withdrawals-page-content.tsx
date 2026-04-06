"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { withdrawalApiClient } from "@/lib/api/withdrawal.client";
import { formatDashboardEarningsTotal } from "@/lib/payment-node/format";
import type { WithdrawalDto } from "@/lib/types/withdrawal";

import { WithdrawalDetailsDialog } from "./withdrawal-details-dialog";

const TAB_KEYS = ["all", "PENDING", "COMPLETED", "FAILED"] as const;
type WithdrawalsTab = (typeof TAB_KEYS)[number];

function isWithdrawalsTab(value: string | null): value is WithdrawalsTab {
  return value !== null && (TAB_KEYS as readonly string[]).includes(value);
}

function shortPayoutAddress(address: string): string {
  const t = address.trim();
  if (t.length <= 14) {
    return t;
  }
  return `${t.slice(0, 8)}…${t.slice(-6)}`;
}

function statusBadgeVariant(
  status: WithdrawalDto["status"],
): "primary-muted" | "success" | "destructive" | "secondary-muted" {
  if (status === "COMPLETED") {
    return "success";
  }
  if (status === "FAILED") {
    return "destructive";
  }
  if (status === "PENDING") {
    return "primary-muted";
  }
  return "secondary-muted";
}

export function WithdrawalsPageContent() {
  const t = useTranslations("App.Withdrawals");
  const formatter = useFormatter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<WithdrawalsTab>("all");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState<WithdrawalDto | null>(null);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (isWithdrawalsTab(tab)) {
      queueMicrotask(() => setActiveTab(tab));
    }
  }, [searchParams]);

  const handleTabChange = useCallback((value: string) => {
    const next = (isWithdrawalsTab(value) ? value : "all") as WithdrawalsTab;
    setActiveTab(next);
    const url = new URL(window.location.href);
    if (next === "all") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", next);
    }
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);

  const listStatus =
    activeTab === "all"
      ? undefined
      : (activeTab as "PENDING" | "COMPLETED" | "FAILED");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["withdrawals", "list", activeTab],
    queryFn: async () => {
      const result = await withdrawalApiClient.list({
        status: listStatus ?? "all",
        limit: 100,
      });
      if (!result.success || !result.data) {
        throw new Error(result.success === false ? result.error : "Failed");
      }
      return result.data.withdrawals;
    },
  });

  const tabConfig = useMemo(
    () => [
      { key: "all", name: t("tabAll") },
      { key: "PENDING", name: t("tabPending") },
      { key: "COMPLETED", name: t("tabCompleted") },
      { key: "FAILED", name: t("tabFailed") },
    ],
    [t],
  );

  const openDetails = useCallback((w: WithdrawalDto) => {
    setSelected(w);
    setDetailsOpen(true);
  }, []);

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
    void refetch();
  }, [queryClient, refetch]);

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <Tabs
        tabs={tabConfig}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("refreshAria")}
          onClick={handleRefresh}
          disabled={isFetching}
        >
          <RefreshCw
            className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      {isError ? (
        <p className="text-destructive text-sm">{t("loadError")}</p>
      ) : isLoading ? (
        <div
          className="bg-muted h-48 w-full animate-pulse rounded-lg"
          aria-busy
        />
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {t("emptyForTab")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">
                  {t("columnInitiated")}
                </TableHead>
                <TableHead>{t("columnAmount")}</TableHead>
                <TableHead>{t("columnNetwork")}</TableHead>
                <TableHead>{t("columnPayoutAddress")}</TableHead>
                <TableHead>{t("columnStatus")}</TableHead>
                <TableHead className="text-end">{t("columnActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatter.dateTime(new Date(w.createdAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </TableCell>
                  <TableCell className="font-mono text-sm tabular-nums">
                    {formatDashboardEarningsTotal(
                      Number.parseFloat(w.amountUsd),
                      "USD",
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{w.network}</TableCell>
                  <TableCell
                    className="font-mono text-xs max-w-[200px] truncate"
                    title={w.payoutAddress}
                  >
                    {shortPayoutAddress(w.payoutAddress)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(w.status)}>
                      {t(
                        w.status === "COMPLETED"
                          ? "statusCompleted"
                          : w.status === "FAILED"
                            ? "statusFailed"
                            : "statusPending",
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-sm font-semibold"
                      onClick={() => openDetails(w)}
                    >
                      {t("viewDetails")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <WithdrawalDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        withdrawal={selected}
      />
    </div>
  );
}
