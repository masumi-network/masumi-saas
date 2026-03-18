"use client";

import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import type { ActivityFeedItem } from "@/lib/types/activity";
import { cn, formatDate } from "@/lib/utils";

const EMPTY_CELL = "\u2014";

export const LIFECYCLE_LABELS: Record<string, string> = {
  RegistrationInitiated: "Registration initiated",
  RegistrationConfirmed: "Registration confirmed",
  RegistrationFailed: "Registration failed",
  DeregistrationRequested: "Deregistration requested",
  DeregistrationConfirmed: "Deregistration confirmed",
  AgentVerified: "Agent verified",
  AgentDeleted: "Agent deleted",
};

/** Tab filter key; maps to API filter (lifecycle = agent lifecycle events). */
export type ActivityTabFilter =
  | "all"
  | "lifecycle"
  | "transactions"
  | "purchases"
  | "payments"
  | "refundRequests"
  | "disputes";

interface ActivityFeedTableProps {
  filter: ActivityTabFilter;
  searchQuery?: string;
  /** Change to trigger a refetch (e.g. from a refresh button). */
  refreshKey?: number;
  /** Called when filtered items change (e.g. to enable/disable CSV download). */
  onFilteredItemsChange?: (items: ActivityFeedItem[]) => void;
}

export interface ActivityFeedTableHandle {
  getFilteredItems: () => ActivityFeedItem[];
}

function filterItemsBySearch(
  items: ActivityFeedItem[],
  query: string,
  lifecycleLabels: Record<string, string>,
  formatDateFn: (iso: string) => string,
): ActivityFeedItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    if (item.kind === "lifecycle") {
      const typeLabel = lifecycleLabels[item.type] ?? item.type;
      return (
        typeLabel.toLowerCase().includes(q) ||
        (item.agentName ?? "").toLowerCase().includes(q) ||
        formatDateFn(item.date).toLowerCase().includes(q)
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
      formatDateFn(item.date).toLowerCase().includes(q)
    );
  });
}

const ActivityFeedTableComponent = function ActivityFeedTableInner(
  {
    filter,
    searchQuery = "",
    refreshKey,
    onFilteredItemsChange,
  }: ActivityFeedTableProps,
  ref: React.Ref<ActivityFeedTableHandle>,
) {
  const t = useTranslations("App.Activity");
  const router = useRouter();
  const { network } = usePaymentNetwork();
  const exportDataRef = useRef<ActivityFeedItem[]>([]);

  const {
    data,
    isLoading,
    error: queryError,
    refetch: fetchFeed,
  } = useQuery({
    queryKey: ["activity", filter, network, refreshKey],
    queryFn: async (): Promise<ActivityFeedItem[]> => {
      const params = new URLSearchParams({ network });
      if (filter !== "all") params.set("filter", filter);
      const url = `/api/activity?${params.toString()}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!json.success) {
        if (json.error) throw new Error(json.error);
        return [];
      }
      return (json.data?.items ?? []) as ActivityFeedItem[];
    },
    staleTime: 25_000,
    refetchInterval: 25_000,
  });

  const error = queryError instanceof Error ? queryError.message : null;
  const items = useMemo(() => (error ? [] : (data ?? [])), [error, data]);

  useImperativeHandle(
    ref,
    () => ({
      getFilteredItems: () => exportDataRef.current ?? [],
    }),
    [],
  );

  const filteredItems = useMemo(
    () =>
      error
        ? []
        : filterItemsBySearch(items, searchQuery, LIFECYCLE_LABELS, formatDate),
    [error, items, searchQuery],
  );

  useEffect(() => {
    exportDataRef.current = filteredItems;
    onFilteredItemsChange?.(filteredItems);
  }, [filteredItems, onFilteredItemsChange]);

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-muted-surface/50 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button
          type="button"
          className="mt-2 text-sm text-primary underline-offset-4 hover:underline"
          onClick={() => fetchFeed()}
        >
          {t("tryAgain")}
        </button>
      </div>
    );
  }

  if (!isLoading && items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted-surface/50 p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("noActivity")}</p>
      </div>
    );
  }

  if (!isLoading && filteredItems.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted-surface/50 p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("noSearchResults")}</p>
      </div>
    );
  }

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
          {isLoading
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
                const handleRowClick = agentId
                  ? () => router.push(`/ai-agents/${agentId}`)
                  : undefined;
                const rowAnimation = {
                  animationDelay: `${Math.min(index, 9) * 40}ms`,
                };
                if (item.kind === "lifecycle") {
                  return (
                    <TableRow
                      key={item.id}
                      className={cn(
                        agentId && "cursor-pointer",
                        "hover:bg-muted/50 animate-table-row-in transition-[background-color,opacity] duration-150",
                      )}
                      style={rowAnimation}
                      onClick={handleRowClick}
                    >
                      <TableCell className="text-sm">
                        {t("lifecycle")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {EMPTY_CELL}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.agentName ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {EMPTY_CELL}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {LIFECYCLE_LABELS[item.type] ?? item.type}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(item.date)}
                      </TableCell>
                    </TableRow>
                  );
                }
                return (
                  <TableRow
                    key={item.id}
                    className={cn(
                      agentId && "cursor-pointer",
                      "hover:bg-muted/50 animate-table-row-in transition-[background-color,opacity] duration-150",
                    )}
                    style={rowAnimation}
                    onClick={handleRowClick}
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
                      {formatDate(item.date)}
                    </TableCell>
                  </TableRow>
                );
              })}
        </TableBody>
      </Table>
    </div>
  );
};

export const ActivityFeedTable = forwardRef(ActivityFeedTableComponent);
