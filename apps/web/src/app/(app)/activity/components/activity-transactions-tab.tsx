"use client";

import { Receipt } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ActivityFeedItem } from "@/lib/types/activity";
import { formatDate } from "@/lib/utils";

export function ActivityTransactionsTab() {
  const t = useTranslations("App.Activity");
  const router = useRouter();
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    setError(null);
    setIsLoading(true);
    fetch("/api/activity?filter=transactions")
      .then((res) => res.json())
      .then(
        (json: {
          success: boolean;
          data?: { items: ActivityFeedItem[] };
          error?: string;
        }) => {
          if (json.success && json.data?.items) {
            setItems(json.data.items);
          } else {
            setItems([]);
            if (!json.success && json.error) setError(json.error);
          }
        },
      )
      .catch((err) => {
        setItems([]);
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

  const transactions = items.filter(
    (i): i is Extract<ActivityFeedItem, { kind: "transaction" }> =>
      i.kind === "transaction",
  );

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{t("type")}</TableHead>
            <TableHead>{t("transactionHash")}</TableHead>
            <TableHead>{t("agent")}</TableHead>
            <TableHead>{t("amount")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("date")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
              </TableRow>
            ))
          ) : transactions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="p-8 text-center">
                <Receipt className="mx-auto size-10 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("noTransactions")}
                </p>
              </TableCell>
            </TableRow>
          ) : (
            transactions.map((tx) => (
              <TableRow
                key={tx.id}
                className={
                  tx.agentId
                    ? "cursor-pointer hover:bg-muted/50"
                    : "hover:bg-muted/50"
                }
                onClick={
                  tx.agentId
                    ? () => router.push(`/ai-agents/${tx.agentId}`)
                    : undefined
                }
              >
                <TableCell className="capitalize">{tx.type}</TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {tx.txHash
                    ? `${tx.txHash.slice(0, 8)}...${tx.txHash.slice(-8)}`
                    : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {tx.agentName ?? "—"}
                </TableCell>
                <TableCell>{tx.amount}</TableCell>
                <TableCell className="text-muted-foreground">
                  {tx.status.replace(/([A-Z])/g, " $1").trim()}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(tx.date)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
