"use client";

import { Plus, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Tabs } from "@/components/ui/tabs";
import { type Agent, agentApiClient } from "@/lib/api/agent.client";

import { AgentsTable } from "./agents-table";
import { AgentsTableSkeleton } from "./agents-table-skeleton";
import { RegisterAgentDialog } from "./register-agent-dialog";

const VALID_TABS = [
  "all",
  "verified",
  "registered",
  "deregistered",
  "pending",
  "failed",
] as const;

function getFiltersForTab(tab: string) {
  switch (tab) {
    case "verified":
      return { verificationStatus: "VERIFIED" as const };
    case "registered":
      return { registrationState: "RegistrationConfirmed" as const };
    case "deregistered":
      return { registrationState: "DeregistrationConfirmed" as const };
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

  const PAGE_SIZE = 10;

  const loadPage = useCallback(
    async (cursorId?: string) => {
      const filters = getFiltersForTab(activeTab);
      const result = await agentApiClient.getAgents(filters, {
        cursorId,
        take: PAGE_SIZE,
      });
      if (result.success) {
        return { data: result.data, nextCursor: result.nextCursor };
      }
      return null;
    },
    [activeTab],
  );

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
  }, [loadPage]);

  const displayedAgents = useMemo(() => {
    if (!searchQuery) return agents;
    const query = searchQuery.toLowerCase();
    return agents.filter((agent) => {
      const matchName = agent.name.toLowerCase().includes(query);
      const matchDescription = agent.description.toLowerCase().includes(query);
      const matchApiUrl = agent.apiUrl.toLowerCase().includes(query);
      const matchTags = agent.tags.some((tag) =>
        tag.toLowerCase().includes(query),
      );
      return matchName || matchDescription || matchApiUrl || matchTags;
    });
  }, [agents, searchQuery]);

  const handleTabChange = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "all") {
      params.delete("tab");
    } else {
      params.set("tab", key);
    }
    router.push(`/agents?${params.toString()}`);
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
      { name: t("tabs.deregistered"), count: null, key: "deregistered" },
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
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
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
              agents={displayedAgents}
              onAgentClick={(agent) => {
                router.push(`/agents/${agent.id}`);
              }}
              onDeleteSuccess={handleDeleteSuccess}
            />

            {nextCursor && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? t("loadingMore") : t("loadMore")}
                </Button>
              </div>
            )}

            {displayedAgents.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground text-sm">
                  {searchQuery
                    ? t("noAgentsMatchingSearch")
                    : activeTab === "registered"
                      ? t("noRegisteredAgents")
                      : activeTab === "deregistered"
                        ? t("noDeregisteredAgents")
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
