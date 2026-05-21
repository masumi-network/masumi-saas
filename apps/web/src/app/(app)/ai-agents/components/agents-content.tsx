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
import { type Agent, agentApiClient } from "@/lib/api/agent.client";
import { isAgentVerificationFlowEnabled } from "@/lib/config/verification.config";
import { useOrganizationContext } from "@/lib/context/organization-context";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import { EVENT_AGENT_REGISTRATION_COMPLETE } from "@/lib/context/registration-completion-context";

import { AgentsDiscovery } from "./agents-discovery";
import { AgentsTable } from "./agents-table";
import { AgentsTableSkeleton } from "./agents-table-skeleton";
import { RegisterAgentDialog } from "./register-agent-dialog";

/** States we sync on list load (in-flight only). Excludes failed states to avoid N syncs + refetch on "failed" tab. */
const SYNC_ON_LOAD_STATES = [
  "RegistrationRequested",
  "RegistrationInitiated",
  "DeregistrationRequested",
  "DeregistrationInitiated",
] as const;

const ALL_TABS = [
  "all",
  "verified",
  "registered",
  "pending",
  "failed",
] as const;

const VALID_SECTIONS = ["manage", "discovery"] as const;

function getFiltersForTab(tab: string) {
  switch (tab) {
    case "verified":
      return { verificationStatus: "VERIFIED" as const };
    case "registered":
      return { registrationState: "RegistrationConfirmed" as const };
    case "pending":
      return {
        registrationStateIn: [
          "RegistrationRequested",
          "DeregistrationRequested",
        ],
      };
    case "failed":
      return {
        registrationStateIn: ["RegistrationFailed", "DeregistrationFailed"],
      };
    default:
      return undefined;
  }
}

export function AgentsContent() {
  const t = useTranslations("App.Agents");
  const router = useRouter();
  const agentVerificationUiEnabled = isAgentVerificationFlowEnabled();
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
  const validTabs: readonly string[] = agentVerificationUiEnabled
    ? ALL_TABS
    : ALL_TABS.filter((tab) => tab !== "verified");
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam && validTabs.includes(tabParam) ? tabParam : "all";
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
      const filters = getFiltersForTab(activeTab);
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
    [activeTab, debouncedSearch, network],
  );

  /** Shared: sync in-flight agents then refetch. Returns refetched page or initial if nothing to sync. */
  const syncPendingAndRefetch = useCallback(
    async (
      initial: { data: Agent[]; nextCursor: string | null },
      cursorId?: string,
    ) => {
      const toSync = initial.data.filter((a) =>
        (SYNC_ON_LOAD_STATES as readonly string[]).includes(
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

  const handleTabChange = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "all") {
      params.delete("tab");
    } else {
      params.set("tab", key);
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
    loadPage(nextCursor).then((page) => {
      if (page) {
        setAgents((prev) => [...prev, ...page.data]);
        setNextCursor(page.nextCursor);
      }
      setIsLoadingMore(false);
    });
  };

  const tabs = useMemo(() => {
    const items = [
      { name: t("tabs.all"), count: null, key: "all" },
      { name: t("tabs.registered"), count: null, key: "registered" },
      { name: t("tabs.pending"), count: null, key: "pending" },
      { name: t("tabs.failed"), count: null, key: "failed" },
    ];

    if (agentVerificationUiEnabled) {
      items.splice(1, 0, {
        name: t("tabs.verified"),
        count: null,
        key: "verified",
      });
    }

    return items;
  }, [agentVerificationUiEnabled, t]);

  const sections = useMemo(
    () => [
      { name: t("sections.manage"), key: "manage" },
      { name: t("sections.discovery"), key: "discovery" },
    ],
    [t],
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
          <div className="space-y-4 rounded-2xl border border-border/80 bg-background/95 p-4 sm:p-6">
            <Tabs
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />

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
            ) : agents.length === 0 ? (
              <div className="rounded-xl border border-dashed px-6 py-14 text-center">
                <div className="mx-auto max-w-md space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Bot className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-base font-medium">
                    {debouncedSearch
                      ? t("noAgentsMatchingSearch")
                      : activeTab === "registered"
                        ? t("noRegisteredAgents")
                        : activeTab === "pending"
                          ? t("noPendingAgents")
                          : activeTab === "failed"
                            ? t("noFailedAgents")
                            : activeTab === "verified"
                              ? t("noVerifiedAgents")
                              : t("noAgents")}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-border/80">
                  <AgentsTable
                    agents={agents}
                    onAgentClick={(agent) => {
                      router.push(`/ai-agents/${agent.id}`);
                    }}
                    onDeleteSuccess={handleDeleteSuccess}
                  />
                </div>

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
