"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { ExternalLink, Inbox, Search } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DiscoveryEmptyState } from "@/components/discovery-empty-state";
import { DiscoveryTableSkeleton } from "@/components/discovery-table-skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  type InboxAgentRegistration,
  registryDiscoveryClient,
} from "@/lib/api/registry-discovery.client";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import { isRegistryUnavailableError } from "@/lib/discovery/registry-unavailable";
import { getInitials } from "@/lib/utils";

import {
  countInboxDiscoveryListFilters,
  InboxAgentsDiscoveryFiltersPopover,
  type InboxDiscoveryListFilters,
  inboxDiscoveryListFiltersToApi,
} from "./inbox-agents-discovery-filters-popover";
import { InboxAgentsDiscoveryTable } from "./inbox-agents-discovery-table";

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
    for (let page = 1; page <= totalPages; page += 1) pages.push(page);
    return pages;
  }

  if (currentPage <= 3) {
    for (let page = 1; page <= 4; page += 1) pages.push(page);
    pages.push("ellipsis");
    pages.push(totalPages);
  } else if (currentPage >= totalPages - 2) {
    pages.push(1);
    pages.push("ellipsis");
    for (let page = totalPages - 3; page <= totalPages; page += 1) {
      pages.push(page);
    }
  } else {
    pages.push(1);
    pages.push("ellipsis");
    for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
      pages.push(page);
    }
    pages.push("ellipsis");
    pages.push(totalPages);
  }

  return pages;
}

function getInboxRegistrationBadgeVariant(
  status: InboxAgentRegistration["status"],
) {
  switch (status) {
    case "Verified":
      return "success" as const;
    case "Pending":
      return "secondary-muted" as const;
    case "Invalid":
      return "destructive" as const;
    case "Deregistered":
      return "outline-muted" as const;
    default:
      return "secondary" as const;
  }
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
              if (!isLoading && currentPage > 1) onPageChange(currentPage - 1);
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
                  if (!isLoading) onPageChange(page);
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
  children: React.ReactNode;
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

function InboxAgentDetailsDialog({
  registration,
  open,
  onOpenChange,
}: {
  registration: InboxAgentRegistration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("App.Agents");
  const { formatRelativeDate } = useFormatDate();

  if (!registration) return null;

  const sourceUrl = registration.RegistrySource.url;
  const policyId = registration.RegistrySource.policyId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[720px]">
        <DialogHeader className="shrink-0 border-b px-6 py-5">
          <div className="flex items-start gap-4 pr-8">
            <Avatar className="h-14 w-14 border border-border/70">
              <AvatarFallback>{getInitials(registration.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-xl">
                  {registration.name}
                </DialogTitle>
                <Badge
                  variant={getInboxRegistrationBadgeVariant(
                    registration.status,
                  )}
                >
                  {registration.status}
                </Badge>
              </div>
              <DialogDescription className="leading-6">
                {registration.description?.trim() || t("Details.noDescription")}
              </DialogDescription>
              <div className="flex flex-wrap gap-2">
                <Badge variant="primary-muted">{registration.agentSlug}</Badge>
                <Badge variant="secondary">{t("Discovery.inboxSource")}</Badge>
                <Badge variant="outline-muted">
                  {t("Discovery.metadataVersion", {
                    version: registration.metadataVersion,
                  })}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <DiscoveryDetailItem label={t("Discovery.inboxSlug")}>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">
                  {registration.agentSlug}
                </span>
                <CopyButton value={registration.agentSlug} />
              </div>
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("table.agentId")}>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono">
                  {registration.agentIdentifier}
                </span>
                <CopyButton value={registration.agentIdentifier} />
              </div>
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("Discovery.verifiedUpdated")}>
              {formatRelativeDate(registration.statusUpdatedAt)}
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("Discovery.added")}>
              {formatRelativeDate(registration.createdAt)}
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("Discovery.policyId")}>
              {policyId ? (
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-mono">
                    {policyId}
                  </span>
                  <CopyButton value={policyId} />
                </div>
              ) : (
                <span className="text-muted-foreground">
                  {t("Discovery.noPolicyId")}
                </span>
              )}
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("Discovery.source")} fullWidth>
              {sourceUrl ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-foreground hover:underline"
                  >
                    {sourceUrl}
                  </Link>
                  <CopyButton value={sourceUrl} />
                  <Button asChild variant="outline" size="sm2">
                    <Link href={sourceUrl} target="_blank" rel="noreferrer">
                      {t("Discovery.openSource")}
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <span className="text-muted-foreground">
                  {t("Discovery.noSourceUrl")}
                </span>
              )}
            </DiscoveryDetailItem>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export function InboxAgentsDiscovery() {
  const t = useTranslations("App.Agents");
  const tInbox = useTranslations("App.InboxAgents.Discovery");
  const { network } = usePaymentNetwork();
  const [listFilters, setListFilters] = useState<InboxDiscoveryListFilters>({
    status: "pending_verified",
  });
  const activeFilterCount = useMemo(
    () => countInboxDiscoveryListFilters(listFilters),
    [listFilters],
  );
  const [state, setState] = useState<CursorPageState<InboxAgentRegistration>>(
    () => createCursorPageState<InboxAgentRegistration>(),
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchCurrentPage, setSearchCurrentPage] = useState(1);
  const [selectedInboxRegistration, setSelectedInboxRegistration] =
    useState<InboxAgentRegistration | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const browseRequestSequenceRef = useRef(0);
  const browseAbortControllerRef = useRef<AbortController | null>(null);
  const debouncedSearch = useDebouncedValue(searchQuery, 200);
  const immediateSearch = searchQuery.trim();
  const normalizedSearch = debouncedSearch.trim();
  const isSearchDebouncing = immediateSearch !== normalizedSearch;

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

  const fetchInboxRegistrations = useCallback(
    async (cursorId?: string, signal?: AbortSignal) => {
      const filter = inboxDiscoveryListFiltersToApi(listFilters);

      return registryDiscoveryClient.getInboxAgentRegistrations(
        {
          network,
          limit: PAGE_SIZE,
          cursorId,
          filter,
        },
        { signal },
      );
    },
    [listFilters, network],
  );

  const searchQueryResult = useInfiniteQuery({
    queryKey: [
      "inbox-agent-registrations-search",
      network,
      normalizedSearch,
      listFilters,
    ],
    initialPageParam: undefined as string | undefined,
    enabled: normalizedSearch.length > 0,
    queryFn: async ({ pageParam, signal }) => {
      const result =
        await registryDiscoveryClient.searchInboxAgentRegistrations(
          {
            network,
            limit: PAGE_SIZE,
            cursorId: pageParam,
            query: normalizedSearch,
            filter: inboxDiscoveryListFiltersToApi(listFilters),
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

  const loadInitial = useCallback(async () => {
    browseAbortControllerRef.current?.abort();
    const controller = new AbortController();
    browseAbortControllerRef.current = controller;
    const requestSequence = ++browseRequestSequenceRef.current;

    setState((current) => ({
      ...current,
      isLoading: true,
      isPageLoading: false,
      error: null,
    }));

    try {
      const result = await fetchInboxRegistrations(
        undefined,
        controller.signal,
      );

      if (
        requestSequence !== browseRequestSequenceRef.current ||
        controller.signal.aborted
      ) {
        return;
      }

      setState({
        pages: result.success ? [result.data.items] : [],
        nextCursors: result.success ? [result.data.nextCursor] : [],
        currentPage: 1,
        isLoading: false,
        isPageLoading: false,
        error: result.success ? null : result.error || t("Discovery.error"),
      });
    } catch (error) {
      if (controller.signal.aborted) return;

      setState((current) => ({
        ...current,
        isLoading: false,
        isPageLoading: false,
        error: error instanceof Error ? error.message : t("Discovery.error"),
      }));
    }
  }, [fetchInboxRegistrations, t]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    setSearchCurrentPage(1);
  }, [listFilters, normalizedSearch, network]);

  const loadPage = useCallback(
    async (page: number) => {
      if (normalizedSearch) {
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

      if (state.isPageLoading) return;
      if (page < 1 || page > getKnownTotalPages(state)) return;

      if (page <= state.pages.length) {
        setState((current) => ({ ...current, currentPage: page }));
        return;
      }

      const cursor = state.nextCursors[state.pages.length - 1];
      if (!cursor) return;

      browseAbortControllerRef.current?.abort();
      const controller = new AbortController();
      browseAbortControllerRef.current = controller;
      const requestSequence = ++browseRequestSequenceRef.current;

      setState((current) => ({
        ...current,
        isPageLoading: true,
        error: null,
      }));

      try {
        const result = await fetchInboxRegistrations(cursor, controller.signal);

        if (
          requestSequence !== browseRequestSequenceRef.current ||
          controller.signal.aborted
        ) {
          return;
        }

        if (!result.success) {
          setState((current) => ({
            ...current,
            isPageLoading: false,
            error: result.error || t("Discovery.error"),
          }));
          return;
        }

        setState((current) => ({
          ...current,
          pages: [...current.pages, result.data.items],
          nextCursors: [...current.nextCursors, result.data.nextCursor],
          currentPage: page,
          isPageLoading: false,
        }));
      } catch (error) {
        if (controller.signal.aborted) return;

        setState((current) => ({
          ...current,
          isPageLoading: false,
          error: error instanceof Error ? error.message : t("Discovery.error"),
        }));
      }
    },
    [fetchInboxRegistrations, normalizedSearch, searchQueryResult, state, t],
  );

  const pageItems = useMemo(() => getCurrentPageItems(state), [state]);
  const sortedPageItems = useMemo(
    () =>
      [...pageItems].sort(
        (left, right) =>
          new Date(right.statusUpdatedAt).getTime() -
          new Date(left.statusUpdatedAt).getTime(),
      ),
    [pageItems],
  );
  const searchPageItems = useMemo(
    () => searchQueryResult.data?.pages[searchCurrentPage - 1]?.items ?? [],
    [searchCurrentPage, searchQueryResult.data],
  );
  const sortedSearchPageItems = useMemo(
    () =>
      [...searchPageItems].sort(
        (left, right) =>
          new Date(right.statusUpdatedAt).getTime() -
          new Date(left.statusUpdatedAt).getTime(),
      ),
    [searchPageItems],
  );
  const hasActiveSearch = normalizedSearch.length > 0;
  const isSearchPendingWithoutResults =
    hasActiveSearch &&
    !searchQueryResult.data &&
    (searchQueryResult.isPending || searchQueryResult.isFetching);
  const visibleItems = hasActiveSearch
    ? isSearchPendingWithoutResults
      ? sortedPageItems
      : sortedSearchPageItems
    : sortedPageItems;

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (hasActiveSearch) {
      void searchQueryResult.refetch().finally(() => setIsRefreshing(false));
      return;
    }

    void loadInitial().finally(() => setIsRefreshing(false));
  };

  const paginationLabels = {
    previous: t("Discovery.previous"),
    next: t("Discovery.next"),
    previousAriaLabel: t("Discovery.paginationPrevious"),
    nextAriaLabel: t("Discovery.paginationNext"),
    ellipsisSrText: t("Discovery.paginationMore"),
  };

  const isSearchLoading = hasActiveSearch
    ? isSearchDebouncing ||
      searchQueryResult.isLoading ||
      searchQueryResult.isFetching
    : state.isPageLoading;
  const activeEmptyLabel = hasActiveSearch
    ? t("Discovery.inboxEmptySearch")
    : t("Discovery.inboxEmpty");
  const activeError = hasActiveSearch
    ? searchQueryResult.error instanceof Error
      ? searchQueryResult.error.message
      : null
    : state.error;
  const registryUnavailable = isRegistryUnavailableError(activeError);
  const activeCurrentPage = hasActiveSearch
    ? searchCurrentPage
    : state.currentPage;
  const activeTotalPages = hasActiveSearch
    ? Math.max(
        1,
        (searchQueryResult.data?.pages.length ?? 0) +
          (searchQueryResult.hasNextPage ? 1 : 0),
      )
    : getKnownTotalPages(state);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <div
          onClick={() => searchInputRef.current?.focus()}
          className="relative flex min-w-0 flex-1 cursor-text items-center gap-2 rounded-lg border border-border/80 bg-muted-surface/60 px-3 py-2.5 text-sm ring-offset-background transition-colors focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 md:max-w-md lg:max-w-sm"
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="search"
            placeholder={t("Discovery.inboxSearchPlaceholder")}
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
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <InboxAgentsDiscoveryFiltersPopover
            filters={listFilters}
            activeFilterCount={activeFilterCount}
            network={network}
            onChange={setListFilters}
            onClear={() => setListFilters({ status: "pending_verified" })}
          />
          <RefreshButton
            onRefresh={handleRefresh}
            size="md"
            isRefreshing={isRefreshing}
          />
        </div>
      </div>

      {activeError && !registryUnavailable ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {activeError}
        </div>
      ) : null}

      {!hasActiveSearch && state.isLoading ? (
        <DiscoveryTableSkeleton columns={6} />
      ) : (
        <>
          {isSearchLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted-surface/50 px-4 py-3 text-sm text-muted-foreground">
              <Spinner size={14} />
              {t("loadingMore")}
            </div>
          ) : null}

          {visibleItems.length > 0 ? (
            <InboxAgentsDiscoveryTable
              registrations={visibleItems}
              onSelect={setSelectedInboxRegistration}
            />
          ) : isSearchLoading ? null : registryUnavailable ? (
            <DiscoveryEmptyState
              icon={Inbox}
              message={tInbox("registryUnavailableTitle")}
              description={tInbox("registryUnavailableDescription")}
            />
          ) : (
            <DiscoveryEmptyState icon={Inbox} message={activeEmptyLabel} />
          )}

          <DiscoveryPaginationBar
            currentPage={activeCurrentPage}
            totalPages={activeTotalPages}
            isLoading={isSearchLoading}
            onPageChange={(page) => {
              void loadPage(page);
            }}
            labels={paginationLabels}
          />

          <InboxAgentDetailsDialog
            registration={selectedInboxRegistration}
            open={selectedInboxRegistration !== null}
            onOpenChange={(open) => {
              if (!open) setSelectedInboxRegistration(null);
            }}
          />
        </>
      )}
    </div>
  );
}
