"use client";

import { ArrowDownLeft, ArrowUpRight, History } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFormatDate } from "@/hooks/use-format-date";
import { AGENT_RECENT_ACTIVITY_PAGE_SIZE } from "@/lib/agents/agent-recent-activity.constants";
import { cn } from "@/lib/utils";

type RecentActivityLifecycleItem = {
  kind: "lifecycle";
  id: string;
  date: string;
  eventKey: string;
  failed?: boolean;
};

type RecentActivityTransactionItem = {
  kind: "transaction";
  id: string;
  date: string;
  txType: "payment" | "purchase";
  amount: string;
  status: string;
  txHash: string | null;
};

type RecentActivityItem =
  | RecentActivityLifecycleItem
  | RecentActivityTransactionItem;

type RecentActivityResponse = {
  success: boolean;
  data?: {
    items: RecentActivityItem[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  error?: string;
};

const TIMELINE_STEP_KEYS = new Set([
  "RegistrationInitiated",
  "RegistrationRequested",
  "RegistrationConfirmed",
  "UpdateInitiated",
  "UpdateRequested",
  "UpdateConfirmed",
  "DeregistrationInitiated",
  "DeregistrationRequested",
  "DeregistrationConfirmed",
]);

function formatTxStatus(status: string): string {
  if (!status) return "—";
  return status.replace(/([A-Z])/g, " $1").trim();
}

type AgentRecentActivityFeedProps = {
  agentId: string;
  /** Bumps when registry sync or agent fields change so the feed refetches. */
  refreshKey: string;
};

export function AgentRecentActivityFeed({
  agentId,
  refreshKey,
}: AgentRecentActivityFeedProps) {
  const t = useTranslations("App.Agents.Details");
  const tTx = useTranslations("App.Agents.Details.Transactions");
  const { formatDateTime, formatRelativeDate } = useFormatDate();

  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<RecentActivityItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const refreshKeyRef = useRef(refreshKey);

  useEffect(() => {
    const refreshChanged = refreshKeyRef.current !== refreshKey;
    if (refreshChanged) {
      refreshKeyRef.current = refreshKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }

    let cancelled = false;
    const pageToLoad = page;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(pageToLoad),
          limit: String(AGENT_RECENT_ACTIVITY_PAGE_SIZE),
        });
        const res = await fetch(
          `/api/agents/${agentId}/recent-activity?${params.toString()}`,
        );
        const json = (await res.json()) as RecentActivityResponse;
        if (cancelled) return;
        if (!res.ok || !json.success || !json.data) {
          setError(json.error ?? t("recentActivityLoadError"));
          setItems([]);
          setTotalPages(1);
          return;
        }
        setItems(json.data.items);
        setTotalPages(json.data.totalPages);
        if (json.data.page !== pageToLoad) {
          setPage(json.data.page);
        }
      } catch {
        if (cancelled) return;
        setError(t("recentActivityLoadError"));
        setItems([]);
        setTotalPages(1);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [agentId, page, refreshKey, t]);

  const lifecycleLabel = (item: RecentActivityLifecycleItem) => {
    let label: string;
    if (TIMELINE_STEP_KEYS.has(item.eventKey)) {
      label = t(
        `statusTimeline.steps.${item.eventKey}` as "statusTimeline.steps.RegistrationRequested",
      );
    } else {
      label = t(
        `recentActivityLifecycle.${item.eventKey}` as "recentActivityLifecycle.AgentVerified",
      );
    }
    if (item.failed) {
      return `${label}${t("statusTimeline.failedMarker")}`;
    }
    return label;
  };

  return (
    <div className="space-y-3">
      <ul
        className="space-y-0 divide-y divide-border/40"
        aria-label={t("recentActivityListAria")}
      >
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 py-3 first:pt-0">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </li>
          ))
        ) : error ? (
          <li className="py-6 text-center text-sm text-muted-foreground">
            {error}
          </li>
        ) : items.length === 0 ? (
          <li className="py-6 text-center text-sm text-muted-foreground">
            {t("recentActivityEmpty")}
          </li>
        ) : (
          items.map((item) => {
            if (item.kind === "lifecycle") {
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 py-3 first:pt-0"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted/30 text-muted-foreground">
                    <History className="size-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug text-foreground">
                      {lifecycleLabel(item)}
                    </p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="mt-0.5 text-xs tabular-nums text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                        >
                          {formatRelativeDate(new Date(item.date))}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="start">
                        {formatDateTime(new Date(item.date))}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </li>
              );
            }

            const TxIcon =
              item.txType === "payment" ? ArrowDownLeft : ArrowUpRight;

            return (
              <li
                key={item.id}
                className="flex items-center gap-3 py-3 first:pt-0"
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-muted-foreground",
                    item.txType === "payment"
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-sky-500/30 bg-sky-500/10",
                  )}
                >
                  <TxIcon className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug text-foreground">
                    {item.txType === "payment"
                      ? tTx("typePayment")
                      : tTx("typePurchase")}
                    <span className="font-normal text-muted-foreground">
                      {" · "}
                      {item.amount}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatTxStatus(item.status)}
                  </p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="mt-0.5 text-xs tabular-nums text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                      >
                        {formatRelativeDate(new Date(item.date))}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="start">
                      {formatDateTime(new Date(item.date))}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </li>
            );
          })
        )}
      </ul>

      {!isLoading && !error && totalPages > 1 ? (
        <Pagination className="mx-0 w-full justify-center pb-1 pt-2">
          <PaginationContent className="gap-1">
            <PaginationItem>
              <PaginationPrevious
                text={t("recentActivityPaginationPrevious")}
                ariaLabel={t("recentActivityPaginationPreviousAria")}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-disabled={page <= 1 || isLoading}
                className={
                  page <= 1 || isLoading
                    ? "pointer-events-none opacity-50 h-8 px-2"
                    : "h-8 px-2"
                }
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink
                isActive
                className="pointer-events-none h-8 min-w-8 px-2 text-xs tabular-nums"
              >
                {t("recentActivityPaginationPage", { page, totalPages })}
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                text={t("recentActivityPaginationNext")}
                ariaLabel={t("recentActivityPaginationNextAria")}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-disabled={page >= totalPages || isLoading}
                className={
                  page >= totalPages || isLoading
                    ? "pointer-events-none opacity-50 h-8 px-2"
                    : "h-8 px-2"
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  );
}
