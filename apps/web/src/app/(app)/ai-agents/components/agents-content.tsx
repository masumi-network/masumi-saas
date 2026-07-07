"use client";

import { Bot, Plus, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs } from "@/components/ui/tabs";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { syncAgentRegistrationStatusAction } from "@/lib/actions/agent.action";
import { REGISTRATION_SYNC_STATES } from "@/lib/agents/registration-state";
import { type Agent, agentApiClient } from "@/lib/api/agent.client";
import { EVENT_AGENT_REGISTRATION_COMPLETE } from "@/lib/context/agent-completion-context";
import { useOrganizationContext } from "@/lib/context/organization-context";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";

import { AgentsDiscovery } from "./agents-discovery";
import {
  type AgentListFilters,
  agentListFiltersToApi,
  agentListFiltersToSearchParams,
  AgentsFiltersPopover,
  countAgentListFilters,
  parseAgentListFilters,
} from "./agents-filters-popover";
import { AgentsTable } from "./agents-table";
import { AgentsTableSkeleton } from "./agents-table-skeleton";
import { RegisterAgentDialog } from "./register-agent-dialog";

const VALID_SECTIONS = ["manage", "discovery"] as const;

function getEmptyStateMessageKey(
  filters: AgentListFilters,
  hasSearch: boolean,
  activeFilterCount: number,
): string {
  if (hasSearch) return "noAgentsMatchingSearch";
  if (filters.registration === "registered") return "noRegisteredAgents";
  if (filters.registration === "pending") return "noPendingAgents";
  if (filters.registration === "failed") return "noFailedAgents";
  if (filters.verification === "verified") return "noVerifiedAgents";
  if (activeFilterCount > 0) return "noAgentsMatchingFilters";
  return "noAgents";
}

export function AgentsContent() {
  const t = useTranslations("App.Agents");
  const router = useRouter();
  const { activeOrganizationId } = useOrganizationContext();
  const { network } = usePaymentNetwork();
  const searchParams = useSearchParams();
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const sectionParam = searchParams.get("section");
  const activeSection = VALID_SECTIONS.includes(
    sectionParam as (typeof VALID_SECTIONS)[number],
  )
    ? (sectionParam as (typeof VALID_SECTIONS)[number])
    : "manage";
  const listFilters = useMemo(
    () => parseAgentListFilters(searchParams),
    [searchParams],
  );
  const activeFilterCount = useMemo(
    () => countAgentListFilters(listFilters),
    [listFilters],
  );
  const [isPending, startTransition] = useTransition();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  useEffect(() => {
    if (activeSection !== "manage") return;

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
  }, [activeSection]);

  const PAGE_SIZE = 10;

  const fetchAgents = useCallback(
    async (cursorId?: string) => {
      const filters = agentListFiltersToApi(listFilters);
      const result = await agentApiClient.getAgents(
        {
          ...filters,
          search: debouncedSearch || undefined,
        },
        {
          cursorId,
          take: PAGE_SIZE,
          network,
        },
      );
      if (result.success) {
        return { data: result.data, nextCursor: result.nextCursor };
      }
      return null;
    },
    [debouncedSearch, listFilters, network],
  );

  /** Shared: sync in-flight agents then refetch. Returns refetched page or initial if nothing to sync. */
  const syncPendingAndRefetch = useCallback(
    async (
      initial: { data: Agent[]; nextCursor: string | null },
      cursorId?: string,
    ) => {
      const toSync = initial.data.filter((a) =>
        (REGISTRATION_SYNC_STATES as readonly string[]).includes(
          a.registrationState,
        ),
      );
      if (toSync.length === 0) return initial;
      await Promise.allSettled(
        toSync.map((a) => syncAgentRegistrationStatusAction(a.id)),
      );
      const updated = await fetchAgents(cursorId);
      return updated ?? initial;
    },
    [fetchAgents],
  );

  const loadPage = useCallback(
    async (cursorId?: string) => {
      const initial = await fetchAgents(cursorId);
      if (!initial) return null;
      return syncPendingAndRefetch(initial, cursorId);
    },
    [fetchAgents, syncPendingAndRefetch],
  );

  useEffect(() => {
    if (activeSection !== "manage") return;

    let cancelled = false;
    queueMicrotask(() => setIsLoading(true));
    startTransition(async () => {
      const initial = await fetchAgents();
      if (cancelled) return;
      if (!initial) {
        setIsLoading(false);
        return;
      }
      setAgents(initial.data);
      setNextCursor(initial.nextCursor);
      setIsLoading(false);

      const page = await syncPendingAndRefetch(initial);
      if (cancelled) return;
      if (page !== initial) {
        setAgents(page.data);
        setNextCursor(page.nextCursor);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    activeSection,
    fetchAgents,
    syncPendingAndRefetch,
    activeOrganizationId,
    network,
  ]);

  // Refetch when background registration completes (toast from provider).
  useEffect(() => {
    if (activeSection !== "manage") return;

    const handler = () => {
      loadPage()
        .then((page) => {
          if (page) {
            setAgents(page.data);
            setNextCursor(page.nextCursor);
          }
        })
        .catch(() => {
          // Network/auth error: list won't refresh; user can manually refresh.
        });
    };
    window.addEventListener(EVENT_AGENT_REGISTRATION_COMPLETE, handler);
    return () =>
      window.removeEventListener(EVENT_AGENT_REGISTRATION_COMPLETE, handler);
  }, [activeSection, loadPage]);

  const pushListFilters = useCallback(
    (next: AgentListFilters) => {
      const params = agentListFiltersToSearchParams(next, searchParams);
      const query = params.toString();
      router.push(query ? `/ai-agents?${query}` : "/ai-agents");
    },
    [router, searchParams],
  );

  const handleSectionChange = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "manage") {
      params.delete("section");
    } else {
      params.set("section", key);
    }
    const query = params.toString();
    router.push(query ? `/ai-agents?${query}` : "/ai-agents");
  };

  const handleRegisterSuccess = () => {
    // Dialog closes via onClose from RegisterAgentDialog; only business logic here.
    // Invalidate the server component cache so the org dashboard
    // reflects the new agent count without requiring a manual reload.
    router.refresh();
    startTransition(async () => {
      const page = await loadPage();
      if (page) {
        setAgents(page.data);
        setNextCursor(page.nextCursor);
      }
    });
  };

  const handleDeleteSuccess = () => {
    router.refresh();
    startTransition(async () => {
      const page = await loadPage();
      if (page) {
        setAgents(page.data);
        setNextCursor(page.nextCursor);
      }
    });
  };

  const handleLoadMore = () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    void loadPage(nextCursor).then((page) => {
      if (page) {
        setAgents((prev) => [...prev, ...page.data]);
        setNextCursor(page.nextCursor);
      }
      setIsLoadingMore(false);
    });
  };

  const sections = useMemo(
    () => [
      { name: t("sections.manage"), key: "manage" },
      { name: t("sections.discovery"), key: "discovery" },
    ],
    [t],
  );

  const emptyStateMessageKey = getEmptyStateMessageKey(
    listFilters,
    !!debouncedSearch,
    activeFilterCount,
  );

  return (
    <>
      <div className="min-w-0 space-y-4">
        <Tabs
          tabs={sections}
          activeTab={activeSection}
          onTabChange={handleSectionChange}
        />

        {activeSection === "manage" ? (
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
                  placeholder={t("searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  className="h-6 min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                />
                {!isSearchFocused && (
                  <kbd className="hidden sm:inline-flex h-6 shrink-0 items-center justify-center rounded-md border bg-muted px-2 font-mono text-xs text-foreground pointer-events-none">
                    {t("searchShortcut")}
                  </kbd>
                )}
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <AgentsFiltersPopover
                  filters={listFilters}
                  activeFilterCount={activeFilterCount}
                  onChange={pushListFilters}
                  onClear={() => pushListFilters({})}
                />
                <RefreshButton
                  onRefresh={() => {
                    startTransition(async () => {
                      const page = await loadPage();
                      if (page) {
                        setAgents(page.data);
                        setNextCursor(page.nextCursor);
                      }
                    });
                  }}
                  size="md"
                  isRefreshing={isPending}
                />
                <Button
                  onClick={() => setIsRegisterDialogOpen(true)}
                  size="icon"
                  className="md:hidden"
                  aria-label={t("registerAgent")}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => setIsRegisterDialogOpen(true)}
                  className="hidden md:flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {t("registerAgent")}
                </Button>
              </div>
            </div>

            {isLoading ? (
              <AgentsTableSkeleton />
            ) : (
              <>
                {agents.length === 0 ? (
                  <div className="rounded-xl border border-dashed px-6 py-14 text-center">
                    <div className="mx-auto max-w-md space-y-3">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Bot className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-base font-medium">
                        {t(emptyStateMessageKey)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/80">
                    <AgentsTable
                      agents={agents}
                      onAgentClick={(agent) => {
                        router.push(`/ai-agents/${agent.id}`);
                      }}
                      onDeleteSuccess={handleDeleteSuccess}
                    />
                  </div>
                )}

                {nextCursor ? (
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? <Spinner size={14} /> : t("loadMore")}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <AgentsDiscovery />
        )}
      </div>

      <RegisterAgentDialog
        open={isRegisterDialogOpen}
        onClose={() => setIsRegisterDialogOpen(false)}
        onSuccess={handleRegisterSuccess}
      />
    </>
  );
}
