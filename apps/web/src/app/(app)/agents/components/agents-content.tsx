"use client";

import { Plus, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Tabs } from "@/components/ui/tabs";
import { type Agent, agentApiClient } from "@/lib/api/agent.client";

import { AgentDetailsDialog } from "./agent-details-dialog";
import { AgentsTable } from "./agents-table";
import { AgentsTableSkeleton } from "./agents-table-skeleton";
import { RegisterAgentDialog } from "./register-agent-dialog";

export function AgentsContent() {
  const t = useTranslations("App.Agents");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [isPending, startTransition] = useTransition();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchAgents = async () => {
    const result = await agentApiClient.getAgents();
    if (result.success && result.data) {
      setAgents(result.data);
      setFetchError(null);
    } else {
      setFetchError(
        result.success === false ? result.error : "Failed to load agents",
      );
    }
    setIsLoading(false);
  };

  useEffect(() => {
    startTransition(fetchAgents);
  }, []);

  const agentIdFromUrl = searchParams.get("agentId");
  const agentFromUrl = useMemo(() => {
    if (!agentIdFromUrl) return null;
    return agents.find((a) => a.id === agentIdFromUrl) || null;
  }, [agents, agentIdFromUrl]);

  const dialogAgent = selectedAgent ?? agentFromUrl;

  const filteredAgents = useMemo(() => {
    let filtered = [...agents];

    if (activeTab === "verified") {
      filtered = filtered.filter(
        (agent) => agent.verificationStatus === "APPROVED",
      );
    } else if (activeTab === "unverified") {
      filtered = filtered.filter(
        (agent) => agent.verificationStatus !== "APPROVED",
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
    startTransition(async () => {
      const result = await agentApiClient.getAgents();
      if (result.success && result.data) {
        setAgents(result.data);
      }
    });
  };

  const handleDeleteSuccess = () => {
    startTransition(async () => {
      const result = await agentApiClient.getAgents();
      if (result.success && result.data) {
        setAgents(result.data);
      }
    });
    setSelectedAgent(null);
  };

  const handleVerificationSuccess = () => {
    const currentAgentId = dialogAgent?.id;
    if (!currentAgentId) return;
    startTransition(async () => {
      const result = await agentApiClient.getAgents();
      if (result.success && result.data) {
        setAgents(result.data);
        const updated = result.data.find((a) => a.id === currentAgentId);
        if (updated) setSelectedAgent(updated);
      }
    });
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
          activeTab={
            tabs.find((tab) => tab.key === activeTab)?.name || tabs[0]!.name
          }
          onTabChange={(tabName) => {
            const tab = tabs.find((t) => t.name === tabName);
            if (tab) setActiveTab(tab.key);
          }}
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
                startTransition(async () => {
                  const result = await agentApiClient.getAgents();
                  if (result.success && result.data) {
                    setAgents(result.data);
                  }
                });
              }}
              size="md"
              isRefreshing={isPending}
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
        ) : fetchError ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center space-y-3">
            <p className="text-sm text-destructive font-medium">{fetchError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFetchError(null);
                setIsLoading(true);
                startTransition(fetchAgents);
              }}
            >
              {t("retry") ?? "Retry"}
            </Button>
          </div>
        ) : (
          <>
            <AgentsTable
              agents={filteredAgents}
              onAgentClick={(agent) => {
                setSelectedAgent(agent);
                router.push(`/agents?agentId=${agent.id}`);
              }}
              onDeleteSuccess={handleDeleteSuccess}
            />

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

      <AgentDetailsDialog
        agent={dialogAgent}
        onClose={() => {
          setSelectedAgent(null);
          router.replace("/agents");
        }}
        onDeleteSuccess={handleDeleteSuccess}
        onVerificationSuccess={handleVerificationSuccess}
      />
    </>
  );
}
