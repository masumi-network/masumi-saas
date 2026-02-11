"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tabs } from "@/components/ui/tabs";
import { type Agent, agentApiClient } from "@/lib/api/agent.client";

import { AgentCredentials, AgentDetails, AgentTransactions } from "./tabs";

interface AgentPageContentProps {
  agent: Agent;
  header: React.ReactNode;
}

const VALID_TAB_KEYS = ["details", "credentials", "transactions"] as const;

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
  header,
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
  const activeTab = isValidTab(tabParam) ? tabParam : DEFAULT_TAB;

  const tabs = [
    { name: tTabs("detailTabs.details"), key: "details" },
    { name: tTabs("detailTabs.credentials"), key: "credentials" },
    { name: tTabs("detailTabs.transactions"), key: "transactions" },
  ];

  const handleTabChange = (key: string) => {
    router.replace(`${pathname}?tab=${key}`);
  };

  const handleDeleteConfirm = () => {
    setIsDeleting(true);
    startTransition(async () => {
      const result = await agentApiClient.deleteAgent(agent.id);
      if (result.success) {
        toast.success(t("deleteSuccess"));
        router.push("/agents");
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
        {header}
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      {activeTab === "details" && (
        <AgentDetails
          agent={agent}
          onDeleteClick={() => setIsDeleteDialogOpen(true)}
        />
      )}

      {activeTab === "credentials" && (
        <AgentCredentials
          agent={agent}
          onVerificationSuccess={handleVerificationSuccess}
        />
      )}

      {activeTab === "transactions" && <AgentTransactions agent={agent} />}

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription", { name: agent.name })}
        confirmText={t("delete")}
        cancelText={t("cancel")}
        isLoading={isDeleting}
        variant="destructive"
      />
    </>
  );
}
