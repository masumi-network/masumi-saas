"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Tabs } from "@/components/ui/tabs";
import { type Agent, agentApiClient } from "@/lib/api/agent.client";

import { AgentPageHeader } from "./agent-page-header";
import { DeleteAgentDialog } from "./delete-agent-dialog";
import {
  AgentCredentials,
  AgentDetails,
  AgentEarnings,
  AgentTransactions,
} from "./tabs";

interface AgentPageContentProps {
  agent: Agent;
}

const VALID_TAB_KEYS = [
  "details",
  "earnings",
  "transactions",
  "credentials",
] as const;

function isValidTab(
  tab: string | null,
): tab is (typeof VALID_TAB_KEYS)[number] {
  return (
    tab !== null &&
    VALID_TAB_KEYS.includes(tab as (typeof VALID_TAB_KEYS)[number])
  );
}

const DEFAULT_TAB = "details";

export function AgentPageContent({
  agent: initialAgent,
}: AgentPageContentProps) {
  const t = useTranslations("App.Agents.Details");
  const tTabs = useTranslations("App.Agents");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [agent, setAgent] = useState<Agent>(initialAgent);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [, startTransition] = useTransition();

  const tabParam = searchParams.get("tab");
  const fromParam = searchParams.get("from");
  const activeTab = isValidTab(tabParam) ? tabParam : DEFAULT_TAB;

  const isFromDashboard = fromParam === "dashboard";
  const backHref = isFromDashboard ? "/" : "/agents";
  const backLabel = isFromDashboard ? t("backToDashboard") : undefined;

  const tabs = [
    { name: tTabs("detailTabs.details"), key: "details" },
    { name: tTabs("detailTabs.earnings"), key: "earnings" },
    { name: tTabs("detailTabs.transactions"), key: "transactions" },
    { name: tTabs("detailTabs.credentials"), key: "credentials" },
  ];

  const handleTabChange = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleDeleteConfirm = () => {
    setIsDeleting(true);
    startTransition(async () => {
      const result = await agentApiClient.deleteAgent(agent.id);
      if (result.success) {
        toast.success(t("deleteSuccess"));
        router.push(backHref);
      } else {
        toast.error(result.error || t("deleteError"));
        setIsDeleting(false);
      }
    });
  };

  const handleVerificationSuccess = () => {
    startTransition(async () => {
      const result = await agentApiClient.getAgent(agent.id);
      if (result.success) {
        setAgent(result.data);
      }
    });
  };

  return (
    <>
      <div className="flex flex-col gap-12 pb-3 pt-1">
        <AgentPageHeader
          agent={agent}
          backHref={backHref}
          backLabel={backLabel}
        />
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      {activeTab === "details" && (
        <AgentDetails
          agent={agent}
          onDeleteClick={() => setIsDeleteDialogOpen(true)}
          onVerificationSuccess={handleVerificationSuccess}
        />
      )}

      {activeTab === "credentials" && (
        <AgentCredentials
          agent={agent}
          onVerificationSuccess={handleVerificationSuccess}
        />
      )}

      {activeTab === "earnings" && <AgentEarnings agent={agent} />}

      {activeTab === "transactions" && <AgentTransactions agent={agent} />}

      <DeleteAgentDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        agentName={agent.name}
        isLoading={isDeleting}
      />
    </>
  );
}
