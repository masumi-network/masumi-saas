"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Tabs } from "@/components/ui/tabs";
import { agentApiClient } from "@/lib/api/agent.client";

import { AgentsTable } from "./agents-table";
import { AgentsTableSkeleton } from "./agents-table-skeleton";
import { RegisterAgentDialog } from "./register-agent-dialog";

const PAGE_SIZE = 10;
const AGENTS_QUERY_KEY = ["agents"] as const;

export function AgentsContent() {
  const t = useTranslations("App.Agents");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const {
    data,
    isLoading,
    isError,
    error,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const result = await agentApiClient.getAgents(undefined, {
        cursorId: pageParam,
        take: PAGE_SIZE,
      });
      if (!result.success) {
        throw new Error(result.error);
      }
      return { data: result.data, nextCursor: result.nextCursor };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  // Flatten all pages into a single agents array
  const agents = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data],
  );

  const filteredAgents = useMemo(() => {
    let filtered = [...agents];

    if (activeTab === "verified") {
      filtered = filtered.filter(
        (agent) => agent.verificationStatus === "VERIFIED",
      );
    } else if (activeTab === "unverified") {
      filtered = filtered.filter(
        (agent) => agent.verificationStatus !== "VERIFIED",
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((agent) => {
        const matchName = agent.name.toLowerCase().includes(query);
        const matchDescription = agent.description
          .toLowerCase()
          .includes(query);
        const matchApiUrl = agent.apiUrl.toLowerCase().includes(query);
        const matchTags = agent.tags.some((tag) =>
          tag.toLowerCase().includes(query),
        );

        return matchName || matchDescription || matchApiUrl || matchTags;
      });
    }

    return filtered;
  }, [agents, searchQuery, activeTab]);

  const handleRegisterSuccess = () => {
    queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
  };

  const handleDeleteSuccess = () => {
    queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const tabs = useMemo(() => {
    return [
      { name: t("tabs.all"), count: null, key: "all" },
      { name: t("tabs.verified"), count: null, key: "verified" },
      { name: t("tabs.unverified"), count: null, key: "unverified" },
    ];
  }, [t]);

  return (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm leading-6">
          {t("description")}
        </p>
      </div>

      <div className="space-y-6">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(key) => setActiveTab(key)}
        />

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
                void refetch();
              }}
              size="md"
              isRefreshing={isRefetching}
            />
            <Button
              onClick={() => setIsRegisterDialogOpen(true)}
              variant="primary"
              size="icon"
              className="md:hidden"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => setIsRegisterDialogOpen(true)}
              variant="primary"
              className="hidden md:flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {t("registerAgent")}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <AgentsTableSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-destructive text-sm">
              {error?.message || t("loadError")}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void refetch();
              }}
            >
              {t("retry")}
            </Button>
          </div>
        ) : (
          <>
            <AgentsTable
              agents={filteredAgents}
              onAgentClick={(agent) => {
                router.push(`/agents/${agent.id}`);
              }}
              onDeleteSuccess={handleDeleteSuccess}
            />

            {hasNextPage && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? t("loadingMore") : t("loadMore")}
                </Button>
              </div>
            )}

            {filteredAgents.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground text-sm">
                  {searchQuery
                    ? t("noAgentsMatchingSearch")
                    : activeTab === "verified"
                      ? t("noVerifiedAgents")
                      : activeTab === "unverified"
                        ? t("noUnverifiedAgents")
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
