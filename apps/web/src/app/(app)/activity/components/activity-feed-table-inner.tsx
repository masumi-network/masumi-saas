"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Activity as ActivityIcon, Receipt, Search } from "lucide-react";
import Link from "next/link";
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
import {
  cn,
  formatDate,
  formatRelativeDate,
  shortenAddress,
} from "@/lib/utils";

import { LIFECYCLE_LABELS } from "./activity-feed-shared";
import { ActivityTransactionDetailsDialog } from "./activity-transaction-details-dialog";

const EMPTY_CELL = "\u2014";

function activityFeedItemDedupeKey(it: ActivityFeedItem): string {
  if (it.kind === "lifecycle") {
    return `lifecycle:${it.id}`;
  }
  return `transaction:${it.type}:${it.id}`;
}

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
      (item.agentIdentifier ?? "").toLowerCase().includes(q) ||
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
  /** When true (platform admin), agent links target `/admin/agents/[id]` instead of `/ai-agents/[id]`. */
  linkAgentsInAdmin?: boolean;
}

type ActivityFeedTableInnerProps = ActivityFeedTableProps & {
  imperativeRef: React.Ref<ActivityFeedTableHandle>;
};

function agentDetailHref(
  agentId: string | null,
  linkAgentsInAdmin: boolean,
): string | null {
  if (!agentId) return null;
  return linkAgentsInAdmin
    ? `/admin/agents/${agentId}`
    : `/ai-agents/${agentId}`;
}

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
  linkAgentsInAdmin = false,
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

  const staleCursorResetAtMsRef = useRef(0);

  useEffect(() => {
    staleCursorResetAtMsRef.current = 0;
  }, [activityQueryKey]);

  useEffect(() => {
    if (!(queryError instanceof StaleCursorError)) return;
    const now = Date.now();
    if (now - staleCursorResetAtMsRef.current < 1_500) return;
    staleCursorResetAtMsRef.current = now;
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
      const key = activityFeedItemDedupeKey(it);
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
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted-surface/50 py-12 px-4 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <ActivityIcon className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">{t("noActivity")}</p>
      </div>
    );
  }

  if (!showInitialSkeleton && filteredItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted-surface/50 py-12 px-4 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Search className="h-6 w-6 text-muted-foreground" />
        </div>
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
                <TableHead>{t("agentIdentifier")}</TableHead>
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
                        <Skeleton className="h-4 w-28" />
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
                    const detailHref = agentDetailHref(
                      agentId,
                      linkAgentsInAdmin,
                    );
                    const lifecycleRowClick = detailHref
                      ? () => router.push(detailHref)
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
                    if (item.kind === "transaction") {
                      const {
                        id,
                        type,
                        agentName,
                        agentId,
                        agentIdentifier,
                        txHash,
                        amount,
                        status,
                        date,
                      } = item;
                      const idHref = agentDetailHref(
                        agentId,
                        linkAgentsInAdmin,
                      );
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
                              id,
                              type,
                              agentName,
                              agentId,
                            });
                          }}
                        >
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 text-sm capitalize">
                              <Receipt className="size-4 text-muted-foreground" />
                              {type}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            {txHash
                              ? `${txHash.slice(0, 8)}...${txHash.slice(-8)}`
                              : EMPTY_CELL}
                          </TableCell>
                          <TableCell className="max-w-[140px]">
                            {!agentIdentifier ? (
                              <span className="text-muted-foreground">
                                {EMPTY_CELL}
                              </span>
                            ) : idHref ? (
                              <Link
                                href={idHref}
                                className="font-mono text-xs text-primary hover:underline"
                                title={agentIdentifier}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {shortenAddress(agentIdentifier, 8)}
                              </Link>
                            ) : (
                              <span
                                className="break-all font-mono text-xs text-muted-foreground"
                                title={agentIdentifier}
                              >
                                {agentIdentifier}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {agentName ?? EMPTY_CELL}
                          </TableCell>
                          <TableCell>{amount}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {status.replace(/([A-Z])/g, " $1").trim()}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatRelativeDate(date)}
                          </TableCell>
                        </TableRow>
                      );
                    }
                    return null;
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
        linkAgentsInAdmin={linkAgentsInAdmin}
      />
    </>
  );
}
