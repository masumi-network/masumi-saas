"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import {
  Activity,
  Bot,
  ChevronRight,
  ExternalLink,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { DiscoveryEmptyState } from "@/components/discovery-empty-state";
import { SectionPanel } from "@/components/section-panel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Spinner } from "@/components/ui/spinner";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFormatDate } from "@/hooks/use-format-date";
import {
  registryDiscoveryClient,
  type RegistryEntry,
  type RegistryEntryFilter,
} from "@/lib/api/registry-discovery.client";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import { formatUnitAmount } from "@/lib/payment-node/format";
import { getInitials } from "@/lib/utils";

const PAGE_SIZE = 12;
const MAX_VISIBLE_PAGES = 5;

type CursorPageState<T> = {
  pages: T[][];
  nextCursors: Array<string | null>;
  currentPage: number;
  isLoading: boolean;
  isPageLoading: boolean;
  error: string | null;
};

function createCursorPageState<T>(): CursorPageState<T> {
  return {
    pages: [],
    nextCursors: [],
    currentPage: 1,
    isLoading: true,
    isPageLoading: false,
    error: null,
  };
}

function getCurrentPageItems<T>(state: CursorPageState<T>): T[] {
  return state.pages[state.currentPage - 1] ?? [];
}

function getKnownTotalPages<T>(state: CursorPageState<T>): number {
  if (state.pages.length === 0) return 1;
  return state.pages.length + (state.nextCursors.at(-1) ? 1 : 0);
}

function getPageNumbers(
  currentPage: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  const pages: Array<number | "ellipsis"> = [];

  if (totalPages <= MAX_VISIBLE_PAGES) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }

  if (currentPage <= 3) {
    for (let i = 1; i <= 4; i++) pages.push(i);
    pages.push("ellipsis");
    pages.push(totalPages);
  } else if (currentPage >= totalPages - 2) {
    pages.push(1);
    pages.push("ellipsis");
    for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    pages.push("ellipsis");
    for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
    pages.push("ellipsis");
    pages.push(totalPages);
  }

  return pages;
}

function formatPricing(
  entry: RegistryEntry,
  free: string,
  dynamic: string,
  unavailable: string,
) {
  const pricing = entry.AgentPricing;

  if (pricing.pricingType === "Free") return free;
  if (pricing.pricingType === "Dynamic") return dynamic;
  if ("FixedPricing" in pricing && pricing.FixedPricing.Amounts.length > 0) {
    return pricing.FixedPricing.Amounts.map((amount) =>
      formatUnitAmount(amount.unit, amount.amount),
    ).join(", ");
  }

  return unavailable;
}

function formatPublisher(entry: RegistryEntry, fallback: string) {
  const parts = [entry.authorName, entry.authorOrganization].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : fallback;
}

function matchesRegistryLookup(entry: RegistryEntry, query: string) {
  if (!query) return true;

  const haystack = [
    entry.name,
    entry.description ?? "",
    entry.agentIdentifier,
    entry.apiBaseUrl,
    entry.authorName ?? "",
    entry.authorOrganization ?? "",
    entry.Capability?.name ?? "",
    entry.Capability?.version ?? "",
    ...(entry.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function DiscoverySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card
          key={index}
          className="rounded-xl border-border/80 py-0 shadow-sm"
        >
          <CardContent className="px-4 py-4 sm:px-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                </div>
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                <div className="flex flex-wrap gap-2">
                  <div className="h-5 w-28 animate-pulse rounded-full bg-muted" />
                  <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DiscoveryPaginationBar({
  currentPage,
  totalPages,
  isLoading,
  onPageChange,
  labels,
}: {
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  labels: {
    previous: string;
    next: string;
    previousAriaLabel: string;
    nextAriaLabel: string;
    ellipsisSrText: string;
  };
}) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            text={labels.previous}
            ariaLabel={labels.previousAriaLabel}
            onClick={() => {
              if (!isLoading && currentPage > 1) {
                onPageChange(currentPage - 1);
              }
            }}
            aria-disabled={isLoading || currentPage === 1}
            className={
              isLoading || currentPage === 1
                ? "pointer-events-none opacity-50"
                : ""
            }
          />
        </PaginationItem>
        {pages.map((page, index) =>
          page === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis srText={labels.ellipsisSrText} />
            </PaginationItem>
          ) : (
            <PaginationItem key={page}>
              <PaginationLink
                onClick={() => {
                  if (!isLoading) {
                    onPageChange(page);
                  }
                }}
                isActive={currentPage === page}
                disabled={isLoading}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            text={labels.next}
            ariaLabel={labels.nextAriaLabel}
            onClick={() => {
              if (!isLoading && currentPage < totalPages) {
                onPageChange(currentPage + 1);
              }
            }}
            aria-disabled={isLoading || currentPage === totalPages}
            className={
              isLoading || currentPage === totalPages
                ? "pointer-events-none opacity-50"
                : ""
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function DiscoveryDetailItem({
  label,
  children,
  fullWidth = false,
}: {
  label: string;
  children: ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "space-y-2 sm:col-span-2" : "space-y-2"}>
      <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="rounded-lg border border-border/70 bg-muted-surface/60 px-3 py-3 text-sm">
        {children}
      </div>
    </div>
  );
}

function RegistryEntryDetailsDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: RegistryEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("App.Agents");
  const { formatRelativeDate } = useFormatDate();

  if (!entry) return null;

  const tags = entry.tags ?? [];
  const capabilityLabel = entry.Capability?.name
    ? entry.Capability.version
      ? `${entry.Capability.name} v${entry.Capability.version}`
      : entry.Capability.name
    : t("Discovery.noCapability");
  const pricingLabel = formatPricing(
    entry,
    t("Discovery.pricing.free"),
    t("Discovery.pricing.dynamic"),
    t("Discovery.pricing.unavailable"),
  );
  const publisher = formatPublisher(entry, t("Discovery.authorFallback"));
  const paymentLabel =
    entry.paymentType === "Web3CardanoV1"
      ? t("Discovery.payment.cardano")
      : t("Discovery.payment.none");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,760px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[760px]">
        <DialogHeader className="shrink-0 border-b px-6 py-5">
          <div className="flex items-start gap-4 pr-8">
            <Avatar className="h-14 w-14 border border-border/70">
              <AvatarImage src={entry.image ?? undefined} alt={entry.name} />
              <AvatarFallback>{getInitials(entry.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-xl">{entry.name}</DialogTitle>
                <Badge variant="success">{entry.status}</Badge>
              </div>
              <DialogDescription className="leading-6">
                {entry.description?.trim() || t("Details.noDescription")}
              </DialogDescription>
              <div className="flex flex-wrap gap-2">
                <Badge variant="primary-muted">{capabilityLabel}</Badge>
                <Badge variant="secondary">{paymentLabel}</Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <DiscoveryDetailItem label={t("table.apiUrl")} fullWidth>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={entry.apiBaseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-foreground hover:underline"
                >
                  {entry.apiBaseUrl}
                </Link>
                <CopyButton value={entry.apiBaseUrl} />
                <Button asChild variant="outline" size="sm2">
                  <Link
                    href={entry.apiBaseUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("Discovery.openEndpoint")}
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("table.agentId")}>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono">
                  {entry.agentIdentifier}
                </span>
                <CopyButton value={entry.agentIdentifier} />
              </div>
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("Discovery.publisher")}>
              {publisher}
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("Discovery.updated")}>
              {formatRelativeDate(entry.updatedAt)}
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("Discovery.health")}>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                {t("Discovery.healthValue", {
                  uptimeCount: entry.uptimeCount,
                  uptimeCheckCount: entry.uptimeCheckCount,
                })}
              </div>
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("Discovery.capability")}>
              {capabilityLabel}
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("Discovery.paymentType")}>
              {paymentLabel}
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("table.price")}>
              {pricingLabel}
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("table.tags")} fullWidth>
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="outline-muted">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">
                  {t("Discovery.noTags")}
                </span>
              )}
            </DiscoveryDetailItem>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function RegistryAgentListItem({
  entry,
  onViewDetails,
}: {
  entry: RegistryEntry;
  onViewDetails: () => void;
}) {
  const t = useTranslations("App.Agents");
  const { formatRelativeDate } = useFormatDate();
  const tags = entry.tags ?? [];
  const capabilityLabel = entry.Capability?.name
    ? entry.Capability.version
      ? `${entry.Capability.name} v${entry.Capability.version}`
      : entry.Capability.name
    : t("Discovery.noCapability");
  const pricingLabel = formatPricing(
    entry,
    t("Discovery.pricing.free"),
    t("Discovery.pricing.dynamic"),
    t("Discovery.pricing.unavailable"),
  );
  const publisher = formatPublisher(entry, t("Discovery.authorFallback"));
  const shortDescription =
    entry.description?.trim() || t("Details.noDescription");

  return (
    <button
      type="button"
      onClick={onViewDetails}
      className="w-full rounded-xl border border-border/80 bg-card text-left shadow-sm transition-all duration-200 hover:border-primary/35 hover:bg-muted-surface/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
        <Avatar className="mt-0.5 h-10 w-10 border border-border/70">
          <AvatarImage src={entry.image ?? undefined} alt={entry.name} />
          <AvatarFallback>{getInitials(entry.name)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-base">
              {entry.name}
            </span>
            <Badge variant="success">{entry.status}</Badge>
          </div>

          <p className="line-clamp-1 text-sm text-muted-foreground">
            {shortDescription}
          </p>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{publisher}</span>
            <span className="text-border">{"\u2022"}</span>
            <span>{formatRelativeDate(entry.updatedAt)}</span>
            <span className="text-border">{"\u2022"}</span>
            <span className="flex items-center gap-1">
              <span className="font-medium text-foreground">
                {t("table.price")}
              </span>
              <span>{pricingLabel}</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="primary-muted">{capabilityLabel}</Badge>
            {tags.length > 0 && (
              <Badge variant="outline-muted">
                {tags.length === 1
                  ? tags[0]
                  : `+${tags.length} ${t("Discovery.tagsLabel")}`}
              </Badge>
            )}
          </div>
        </div>

        <div className="hidden items-center gap-2 self-center text-xs text-muted-foreground sm:flex">
          <span>{t("Discovery.viewDetails")}</span>
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </button>
  );
}

export function AgentsDiscovery() {
  const t = useTranslations("App.Agents");
  const { network } = usePaymentNetwork();
  const [registryState, setRegistryState] = useState<
    CursorPageState<RegistryEntry>
  >(() => createCursorPageState<RegistryEntry>());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchCurrentPage, setSearchCurrentPage] = useState(1);
  const [selectedRegistryEntry, setSelectedRegistryEntry] =
    useState<RegistryEntry | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const browseRequestSequenceRef = useRef(0);
  const browseAbortControllerRef = useRef<AbortController | null>(null);
  const debouncedSearch = useDebouncedValue(searchQuery, 200);
  const trimmedSearch = searchQuery.trim();
  const immediateSearch = trimmedSearch.toLowerCase();
  const normalizedSearch = debouncedSearch.trim();
  const isSearchDebouncing = trimmedSearch !== normalizedSearch;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key?.toLowerCase() !== "f") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      e.preventDefault();
      searchInputRef.current?.focus();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(
    () => () => {
      browseAbortControllerRef.current?.abort();
    },
    [],
  );

  const fetchRegistryEntries = useCallback(
    async (cursorId?: string, signal?: AbortSignal) => {
      const filter: RegistryEntryFilter = {
        status: ["Online"],
      };

      return registryDiscoveryClient.getRegistryEntries(
        {
          network,
          limit: PAGE_SIZE,
          cursorId,
          filter,
        },
        { signal },
      );
    },
    [network],
  );

  const searchQueryResult = useInfiniteQuery({
    queryKey: ["registry-entry-search", network, normalizedSearch],
    initialPageParam: undefined as string | undefined,
    enabled: normalizedSearch.length > 0,
    queryFn: async ({ pageParam, signal }) => {
      const result = await registryDiscoveryClient.searchRegistryEntries(
        {
          network,
          limit: PAGE_SIZE,
          cursorId: pageParam,
          query: normalizedSearch,
          filter: {
            status: ["Online"],
          },
        },
        { signal },
      );

      if (!result.success) {
        throw new Error(result.error || t("Discovery.error"));
      }

      return result.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: (previousData) => previousData,
  });

  const loadRegistryInitial = useCallback(async () => {
    browseAbortControllerRef.current?.abort();
    const controller = new AbortController();
    browseAbortControllerRef.current = controller;
    const requestSequence = ++browseRequestSequenceRef.current;

    setRegistryState((current) => ({
      ...current,
      isLoading: true,
      isPageLoading: false,
      error: null,
    }));

    try {
      const result = await fetchRegistryEntries(undefined, controller.signal);

      if (
        requestSequence !== browseRequestSequenceRef.current ||
        controller.signal.aborted
      ) {
        return;
      }

      setRegistryState({
        pages: result.success ? [result.data.items] : [],
        nextCursors: result.success ? [result.data.nextCursor] : [],
        currentPage: 1,
        isLoading: false,
        isPageLoading: false,
        error: result.success ? null : result.error || t("Discovery.error"),
      });
    } catch (error) {
      if (controller.signal.aborted) return;

      setRegistryState((current) => ({
        ...current,
        isLoading: false,
        isPageLoading: false,
        error: error instanceof Error ? error.message : t("Discovery.error"),
      }));
    }
  }, [fetchRegistryEntries, t]);

  useEffect(() => {
    void loadRegistryInitial();
  }, [loadRegistryInitial]);

  useEffect(() => {
    setSearchCurrentPage(1);
  }, [normalizedSearch, network]);

  const loadRegistryPage = useCallback(
    async (page: number) => {
      const useSearchPagination =
        normalizedSearch.length > 0 && Boolean(searchQueryResult.data);

      if (useSearchPagination) {
        const searchTotalPages =
          (searchQueryResult.data?.pages.length ?? 0) +
          (searchQueryResult.hasNextPage ? 1 : 0);

        if (page < 1 || page > Math.max(1, searchTotalPages)) return;

        if (page <= (searchQueryResult.data?.pages.length ?? 0)) {
          setSearchCurrentPage(page);
          return;
        }

        if (
          !searchQueryResult.hasNextPage ||
          searchQueryResult.isFetchingNextPage
        ) {
          return;
        }

        const result = await searchQueryResult.fetchNextPage();
        if (result.error) return;

        setSearchCurrentPage(page);
        return;
      }

      if (registryState.isPageLoading) return;
      if (page < 1 || page > getKnownTotalPages(registryState)) return;

      if (page <= registryState.pages.length) {
        setRegistryState((current) => ({ ...current, currentPage: page }));
        return;
      }

      const cursor =
        registryState.nextCursors[registryState.pages.length - 1] ?? null;
      if (!cursor) return;

      browseAbortControllerRef.current?.abort();
      const controller = new AbortController();
      browseAbortControllerRef.current = controller;
      const requestSequence = ++browseRequestSequenceRef.current;

      setRegistryState((current) => ({
        ...current,
        isPageLoading: true,
        error: null,
      }));

      try {
        const result = await fetchRegistryEntries(cursor, controller.signal);

        if (
          requestSequence !== browseRequestSequenceRef.current ||
          controller.signal.aborted
        ) {
          return;
        }

        if (!result.success) {
          setRegistryState((current) => ({
            ...current,
            isPageLoading: false,
            error: result.error || t("Discovery.error"),
          }));
          return;
        }

        setRegistryState((current) => ({
          ...current,
          pages: [...current.pages, result.data.items],
          nextCursors: [...current.nextCursors, result.data.nextCursor],
          currentPage: page,
          isPageLoading: false,
        }));
      } catch (error) {
        if (controller.signal.aborted) return;

        setRegistryState((current) => ({
          ...current,
          isPageLoading: false,
          error: error instanceof Error ? error.message : t("Discovery.error"),
        }));
      }
    },
    [
      fetchRegistryEntries,
      normalizedSearch,
      registryState,
      searchQueryResult,
      t,
    ],
  );

  const pageItems = useMemo(
    () => getCurrentPageItems(registryState),
    [registryState],
  );
  const sortedPageItems = useMemo(
    () =>
      [...pageItems].sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
      ),
    [pageItems],
  );
  const locallyFilteredPageItems = useMemo(
    () =>
      sortedPageItems.filter((entry) =>
        matchesRegistryLookup(entry, immediateSearch),
      ),
    [immediateSearch, sortedPageItems],
  );
  const searchPageItems = useMemo(
    () => searchQueryResult.data?.pages[searchCurrentPage - 1]?.items ?? [],
    [searchCurrentPage, searchQueryResult.data],
  );
  const sortedSearchPageItems = useMemo(
    () =>
      [...searchPageItems].sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
      ),
    [searchPageItems],
  );

  const hasActiveSearch = normalizedSearch.length > 0;
  const isSearchPendingWithoutResults =
    hasActiveSearch &&
    !searchQueryResult.data &&
    (searchQueryResult.isPending || searchQueryResult.isFetching);
  const shouldUseSearchResults =
    hasActiveSearch &&
    Boolean(searchQueryResult.data) &&
    !isSearchPendingWithoutResults;
  const visibleRegistryEntries = shouldUseSearchResults
    ? sortedSearchPageItems
    : locallyFilteredPageItems;

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (hasActiveSearch) {
      searchQueryResult.refetch().finally(() => setIsRefreshing(false));
      return;
    }

    loadRegistryInitial().finally(() => setIsRefreshing(false));
  };

  const summaryLabel = t("Discovery.resultsSummary", {
    visibleCount: visibleRegistryEntries.length,
    loadedCount: shouldUseSearchResults
      ? searchPageItems.length
      : pageItems.length,
  });

  const emptyLabel = hasActiveSearch
    ? t("Discovery.emptySearch")
    : t("Discovery.empty");

  const paginationLabels = {
    previous: t("Discovery.previous"),
    next: t("Discovery.next"),
    previousAriaLabel: t("Discovery.paginationPrevious"),
    nextAriaLabel: t("Discovery.paginationNext"),
    ellipsisSrText: t("Discovery.paginationMore"),
  };
  const searchErrorMessage =
    searchQueryResult.error instanceof Error
      ? searchQueryResult.error.message
      : null;
  const activeError = hasActiveSearch
    ? searchErrorMessage
    : registryState.error;
  const isSearchLoading = hasActiveSearch
    ? isSearchDebouncing ||
      searchQueryResult.isLoading ||
      searchQueryResult.isFetching
    : registryState.isPageLoading;
  const activeCurrentPage = hasActiveSearch
    ? searchCurrentPage
    : registryState.currentPage;
  const activeTotalPages = hasActiveSearch
    ? Math.max(
        1,
        (searchQueryResult.data?.pages.length ?? 0) +
          (searchQueryResult.hasNextPage ? 1 : 0),
      )
    : getKnownTotalPages(registryState);

  return (
    <SectionPanel>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="success">{t("Discovery.onlineOnly")}</Badge>
          <span className="text-sm text-muted-foreground">
            {t("Discovery.sortHint")}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            {network}
          </span>
          <span className="text-sm text-muted-foreground">
            {t("Discovery.page", { page: activeCurrentPage })}
          </span>
          <RefreshButton
            onRefresh={handleRefresh}
            size="md"
            isRefreshing={isRefreshing}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div
          onClick={() => searchInputRef.current?.focus()}
          className="relative flex min-w-0 flex-1 cursor-text items-center gap-2 rounded-lg border border-border/80 bg-muted-surface/60 px-3 py-2.5 text-sm ring-offset-background transition-colors focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="search"
            placeholder={t("Discovery.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="h-6 min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
          {!isSearchFocused && (
            <kbd className="pointer-events-none hidden h-6 shrink-0 items-center justify-center rounded-md border bg-muted px-2 font-mono text-xs text-foreground sm:inline-flex">
              {t("searchShortcut")}
            </kbd>
          )}
        </div>
        <p className="shrink-0 text-sm text-muted-foreground">{summaryLabel}</p>
      </div>

      {activeError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {activeError}
        </div>
      )}

      {!hasActiveSearch && registryState.isLoading ? (
        <DiscoverySkeleton />
      ) : (
        <>
          {isSearchLoading && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted-surface/50 px-4 py-3 text-sm text-muted-foreground">
              <Spinner size={14} />
              {t("loadingMore")}
            </div>
          )}

          {visibleRegistryEntries.length > 0 ? (
            <div className="space-y-3">
              {visibleRegistryEntries.map((entry) => (
                <RegistryAgentListItem
                  key={entry.id}
                  entry={entry}
                  onViewDetails={() => setSelectedRegistryEntry(entry)}
                />
              ))}
            </div>
          ) : (
            <DiscoveryEmptyState icon={Bot} message={emptyLabel} />
          )}

          <DiscoveryPaginationBar
            currentPage={activeCurrentPage}
            totalPages={activeTotalPages}
            isLoading={isSearchLoading}
            onPageChange={(page) => {
              void loadRegistryPage(page);
            }}
            labels={paginationLabels}
          />

          <RegistryEntryDetailsDialog
            entry={selectedRegistryEntry}
            open={selectedRegistryEntry !== null}
            onOpenChange={(open) => {
              if (!open) setSelectedRegistryEntry(null);
            }}
          />
        </>
      )}
    </SectionPanel>
  );
}
