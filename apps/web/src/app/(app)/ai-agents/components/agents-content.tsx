"use client";

import { Plus, Search } from "lucide-react";
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
import { type Agent, agentApiClient } from "@/lib/api/agent.client";
import { useOrganizationContext } from "@/lib/context/organization-context";

import { AgentsTable } from "./agents-table";
import { AgentsTableSkeleton } from "./agents-table-skeleton";
import { RegisterAgentDialog } from "./register-agent-dialog";

const VALID_TABS = [
  "all",
  "verified",
  "registered",
  "pending",
  "failed",
] as const;

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
  const { activeOrganization } = useOrganizationContext();
  const searchParams = useSearchParams();
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const tabParam = searchParams.get("tab");
  const activeTab = VALID_TABS.includes(tabParam as (typeof VALID_TABS)[number])
    ? (tabParam as (typeof VALID_TABS)[number])
    : "all";
  const [isPending, startTransition] = useTransition();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

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

  const PAGE_SIZE = 10;

  const loadPage = useCallback(
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
        },
      );
      if (result.success) {
        return { data: result.data, nextCursor: result.nextCursor };
      }
      return null;
    },
    [activeTab, debouncedSearch],
  );

  const activeOrganizationId = activeOrganization?.id ?? null;

  useEffect(() => {
    queueMicrotask(() => setIsLoading(true));
    startTransition(async () => {
      const page = await loadPage();
      if (page) {
        setAgents(page.data);
        setNextCursor(page.nextCursor);
      }
      setIsLoading(false);
    });
  }, [loadPage, activeOrganizationId]);

  const handleTabChange = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "all") {
      params.delete("tab");
    } else {
      params.set("tab", key);
    }
    router.push(`/ai-agents?${params.toString()}`);
  };

  const handleRegisterSuccess = () => {
    startTransition(async () => {
      const page = await loadPage();
      if (page) {
        setAgents(page.data);
        setNextCursor(page.nextCursor);
      }
    });
  };

  const handleDeleteSuccess = () => {
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

  const tabs = useMemo(
    () => [
      { name: t("tabs.all"), count: null, key: "all" },
      { name: t("tabs.verified"), count: null, key: "verified" },
      { name: t("tabs.registered"), count: null, key: "registered" },
      { name: t("tabs.pending"), count: null, key: "pending" },
      { name: t("tabs.failed"), count: null, key: "failed" },
    ],
    [t],
  );

  return (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm leading-6">
          {t("description")}
        </p>
      </div>

      <div className="min-w-0 space-y-6">
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="flex items-center justify-between gap-4">
          <div
            onClick={() => searchInputRef.current?.focus()}
            className="relative flex w-64 cursor-text items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
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
          <div className="flex items-center gap-2">
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
        ) : (
          <>
            <AgentsTable
              agents={agents}
              onAgentClick={(agent) => {
                router.push(`/ai-agents/${agent.id}`);
              }}
              onDeleteSuccess={handleDeleteSuccess}
            />

            {nextCursor && (
              <div className="flex justify-center mb-10">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? <Spinner size={14} /> : t("loadMore")}
                </Button>
              </div>
            )}

            {agents.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground text-sm">
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
            )}
          </>
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
