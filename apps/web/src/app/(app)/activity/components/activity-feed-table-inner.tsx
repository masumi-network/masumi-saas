"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
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
  getActivityInfiniteQueryKey,
  StaleCursorError,
  useActivityFeedInfiniteQuery,
} from "@/lib/hooks/use-activity-feed-infinite-query";
import type { ActivityFeedItem, ActivityTabFilter } from "@/lib/types/activity";
import { cn, formatDate, formatRelativeDate } from "@/lib/utils";

import { LIFECYCLE_LABELS } from "./activity-feed-shared";
import { ActivityTransactionDetailsDialog } from "./activity-transaction-details-dialog";

const EMPTY_CELL = "\u2014";

function activityDateMatchesSearch(iso: string, q: string): boolean {
  const haystack =
    `${formatRelativeDate(iso)} ${formatDate(iso)}`.toLowerCase();
  return haystack.includes(q);
}

function filterItemsBySearch(
  items: ActivityFeedItem[],
  searchText: string,
  lifecycleLabels: Record<string, string>,
): ActivityFeedItem[] {
  const q = searchText.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    if (item.kind === "lifecycle") {
      const typeLabel = lifecycleLabels[item.type] ?? item.type;
      return (
        typeLabel.toLowerCase().includes(q) ||
        (item.agentName ?? "").toLowerCase().includes(q) ||
        activityDateMatchesSearch(item.date, q)
      );
    }
    const statusFormatted = item.status.replace(/([A-Z])/g, " $1").trim();
    return (
      item.type.toLowerCase().includes(q) ||
      (item.agentName ?? "").toLowerCase().includes(q) ||
      (item.amount ?? "").toLowerCase().includes(q) ||
      item.status.toLowerCase().includes(q) ||
      statusFormatted.toLowerCase().includes(q) ||
      (item.txHash ?? "").toLowerCase().includes(q) ||
      activityDateMatchesSearch(item.date, q)
    );
  });
}

export interface ActivityFeedTableHandle {
  getFilteredItems: () => ActivityFeedItem[];
}

export interface ActivityFeedTableProps {
  filter: ActivityTabFilter;
  searchQuery?: string;
  refreshKey?: number;
  onFilteredItemsChange?: (items: ActivityFeedItem[]) => void;
}

type ActivityFeedTableInnerProps = ActivityFeedTableProps & {
  imperativeRef: React.Ref<ActivityFeedTableHandle>;
};

type TransactionDetailsSelection = {
  id: string;
  type: "payment" | "purchase";
  agentName: string | null;
  agentId: string | null;
};

export function ActivityFeedTableInner({
  filter,
  searchQuery = "",
  refreshKey,
  onFilteredItemsChange,
  imperativeRef,
}: ActivityFeedTableInnerProps) {
  const { network } = usePaymentNetwork();
  const queryClient = useQueryClient();
  const activityQuery = useActivityFeedInfiniteQuery(
    filter,
    network,
    refreshKey ?? 0,
  );

  const activityQueryKey = useMemo(
    () => getActivityInfiniteQueryKey(filter, network, refreshKey ?? 0),
    [filter, network, refreshKey],
  );

  const t = useTranslations("App.Activity");
  const router = useRouter();
  const exportDataRef = useRef<ActivityFeedItem[]>([]);
  const [transactionDetails, setTransactionDetails] =
    useState<TransactionDetailsSelection | null>(null);

  /** Local aliases: RQ infinite result + TS narrows `data` to `never` if used inside deps as `activityQuery.data`. */
  const queryError = activityQuery.error;

  useEffect(() => {
    if (!(queryError instanceof StaleCursorError)) return;
    void queryClient.resetQueries({ queryKey: activityQueryKey });
  }, [activityQueryKey, queryClient, queryError]);

  const error =
    queryError instanceof StaleCursorError
      ? null
      : queryError instanceof Error
        ? queryError.message
        : null;

  const queryData = activityQuery.data;
  const items = useMemo(() => {
    if (error) return [];
    const pages = queryData?.pages ?? [];
    const flat = pages.flatMap((p) => p.items);
    const seen = new Set<string>();
    return flat.filter((it) => {
      const key = `${it.kind}:${it.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [queryData, error]);

  useImperativeHandle(
    imperativeRef,
    () => ({
      getFilteredItems: () => exportDataRef.current ?? [],
    }),
    [],
  );

  const filteredItems = useMemo(
    () =>
      error ? [] : filterItemsBySearch(items, searchQuery, LIFECYCLE_LABELS),
    [error, items, searchQuery],
  );

  useEffect(() => {
    exportDataRef.current = filteredItems;
    onFilteredItemsChange?.(filteredItems);
  }, [filteredItems, onFilteredItemsChange]);

  const showInitialSkeleton =
    activityQuery.isPending &&
    !(queryData?.pages && queryData.pages.length > 0);

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-muted-surface/50 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button
          type="button"
          className="mt-2 text-sm text-primary underline-offset-4 hover:underline"
          onClick={() => void activityQuery.refetch()}
        >
          {t("tryAgain")}
        </button>
      </div>
    );
  }

  if (!showInitialSkeleton && items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted-surface/50 p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("noActivity")}</p>
      </div>
    );
  }

  if (!showInitialSkeleton && filteredItems.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted-surface/50 p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("noSearchResults")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-0 rounded-md border">
        <div className="overflow-x-auto">
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
              {showInitialSkeleton
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
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
                : filteredItems.map((item, index) => {
                    const agentId = item.agentId ?? null;
                    const lifecycleRowClick = agentId
                      ? () => router.push(`/ai-agents/${agentId}`)
                      : undefined;
                    const rowStyle = {
                      animationDelay: `${Math.min(index, 9) * 40}ms`,
                    };
                    const rowKey = `${item.kind}-${item.id}`;
                    if (item.kind === "lifecycle") {
                      return (
                        <TableRow
                          key={rowKey}
                          className={cn(
                            agentId && "cursor-pointer",
                            "hover:bg-muted/50 animate-table-row-in transition-[background-color,opacity] duration-150",
                          )}
                          style={rowStyle}
                          onClick={
                            lifecycleRowClick
                              ? (e) => {
                                  e.stopPropagation();
                                  lifecycleRowClick();
                                }
                              : undefined
                          }
                        >
                          <TableCell className="text-sm">
                            {t("lifecycle")}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {EMPTY_CELL}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.agentName ?? EMPTY_CELL}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {EMPTY_CELL}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {LIFECYCLE_LABELS[item.type] ?? item.type}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatRelativeDate(item.date)}
                          </TableCell>
                        </TableRow>
                      );
                    }
                    if (item.kind !== "transaction") {
                      return null;
                    }
                    return (
                      <TableRow
                        key={rowKey}
                        className={cn(
                          "cursor-pointer",
                          "hover:bg-muted/50 animate-table-row-in transition-[background-color,opacity] duration-150",
                        )}
                        style={rowStyle}
                        onClick={(e) => {
                          e.stopPropagation();
                          setTransactionDetails({
                            id: item.id,
                            type: item.type,
                            agentName: item.agentName,
                            agentId: item.agentId,
                          });
                        }}
                      >
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-sm capitalize">
                            <Receipt className="size-4 text-muted-foreground" />
                            {item.type}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {item.txHash
                            ? `${item.txHash.slice(0, 8)}...${item.txHash.slice(-8)}`
                            : EMPTY_CELL}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.agentName ?? EMPTY_CELL}
                        </TableCell>
                        <TableCell>{item.amount}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.status.replace(/([A-Z])/g, " $1").trim()}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatRelativeDate(item.date)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </div>
        {!showInitialSkeleton && filteredItems.length > 0 ? (
          <div className="flex flex-col items-center gap-2 border-t px-3 py-4 sm:px-4">
            {activityQuery.hasNextPage ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-w-[7.5rem]"
                onClick={() => void activityQuery.fetchNextPage()}
                disabled={activityQuery.isFetchingNextPage}
              >
                {activityQuery.isFetchingNextPage ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner size={14} />
                    {t("loadMoreLoading")}
                  </span>
                ) : (
                  t("loadMore")
                )}
              </Button>
            ) : items.length > 0 ? (
              <span className="text-xs text-muted-foreground/70">
                {t("endOfResults")}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <ActivityTransactionDetailsDialog
        open={transactionDetails !== null}
        onClose={() => setTransactionDetails(null)}
        transactionId={transactionDetails?.id ?? null}
        transactionType={transactionDetails?.type ?? null}
        agentName={transactionDetails?.agentName ?? null}
        agentId={transactionDetails?.agentId ?? null}
      />
    </>
  );
}
