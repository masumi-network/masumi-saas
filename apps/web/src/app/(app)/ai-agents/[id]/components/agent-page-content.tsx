"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Tabs } from "@/components/ui/tabs";
import { syncAgentRegistrationStatusAction } from "@/lib/actions/agent.action";
import { isRegistrationUiPending } from "@/lib/agents/registration-state";
import { type Agent, agentApiClient } from "@/lib/api/agent.client";
import { credentialApiClient } from "@/lib/api/credential.client";
import { isAgentVerificationFlowEnabled } from "@/lib/config/verification.config";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import type { PaymentNodeNetwork } from "@/lib/payment-node";

import { AgentPageHeader } from "./agent-page-header";
import { DeleteAgentDialog } from "./delete-agent-dialog";
import { DeregisterAgentDialog } from "./deregister-agent-dialog";
import { NetworkMismatchDialog } from "./network-mismatch-dialog";
import {
  AgentDetails,
  AgentEarnings,
  AgentTransactions,
  AgentVerificationTab,
} from "./tabs";

interface AgentPageContentProps {
  agent: Agent;
}

const DEFAULT_TAB = "details";
const VERIFICATION_TAB = "verification";
const LEGACY_CREDENTIALS_TAB = "credentials";

function isValidNetwork(
  value: string | null | undefined,
): value is PaymentNodeNetwork {
  return value === "Preprod" || value === "Mainnet";
}

export function AgentPageContent({
  agent: initialAgent,
}: AgentPageContentProps) {
  const t = useTranslations("App.Agents.Details");
  const tTabs = useTranslations("App.Agents");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { network, setNetwork } = usePaymentNetwork();
  const [agent, setAgent] = useState<Agent>(initialAgent);
  const agentVerificationUiEnabled = isAgentVerificationFlowEnabled();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeregisterDialogOpen, setIsDeregisterDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeregistering, setIsDeregistering] = useState(false);

  const agentNetwork = isValidNetwork(agent.networkIdentifier)
    ? agent.networkIdentifier
    : null;
  // Track if user explicitly dismissed the dialog (e.g. clicked "Go back")
  const [networkDialogDismissed, setNetworkDialogDismissed] = useState(false);
  const isNetworkDialogOpen =
    agentNetwork !== null &&
    agentNetwork !== network &&
    !networkDialogDismissed;

  const handleSwitchNetwork = () => {
    if (agentNetwork) {
      setNetworkDialogDismissed(true);
      setNetwork(agentNetwork);
    }
  };

  const handleNetworkDialogBack = () => {
    setNetworkDialogDismissed(true);
    router.back();
  };

  const pendingRegistration = isRegistrationUiPending(agent.registrationState);

  // RegistrationFailed may eventually have an agentIdentifier populated on the
  // payment node (the tx can land on-chain after the initial failure response).
  // Run one sync on mount so we pick it up without continuous polling.
  const syncAndRefetch = useCallback(async () => {
    await syncAgentRegistrationStatusAction(agent.id);
    const result = await agentApiClient.getAgent(agent.id);
    if (result.success && result.data) setAgent(result.data);
  }, [agent.id]);

  const syncAndRefetchRef = useRef(syncAndRefetch);
  useEffect(() => {
    syncAndRefetchRef.current = syncAndRefetch;
  }, [syncAndRefetch]);

  // Ref: we only run the RegistrationFailed one-time sync once per agent, so when
  // syncAndRefetch updates agent and the effect re-runs we don't sync again.
  const registrationFailedSyncAgentIdRef = useRef<string | null>(null);

  const pollTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always reconcile once on mount — payment-node may be UpdateRequested while
  // SaaS DB is still RegistrationConfirmed until we sync.
  const mountSyncAgentIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (mountSyncAgentIdRef.current === agent.id) return;
    mountSyncAgentIdRef.current = agent.id;
    void syncAndRefetchRef.current();
  }, [agent.id]);

  // Poll while pending: one run then chain next every 12s.
  useEffect(() => {
    if (!pendingRegistration) return;
    let cancelled = false;
    const scheduleNext = () => {
      if (cancelled) return;
      pollTimeoutIdRef.current = setTimeout(() => {
        if (cancelled) return;
        void (async () => {
          await syncAndRefetchRef.current();
          if (cancelled) return;
          scheduleNext();
        })();
      }, 12_000);
    };
    void (async () => {
      await syncAndRefetchRef.current();
      if (cancelled) return;
      scheduleNext();
    })();
    return () => {
      cancelled = true;
      if (pollTimeoutIdRef.current != null) {
        clearTimeout(pollTimeoutIdRef.current);
        pollTimeoutIdRef.current = null;
      }
    };
  }, [pendingRegistration, agent.id]);

  // One-time sync for RegistrationFailed (tx may land on-chain after initial failure).
  // Use ref so effect doesn't re-run when syncAndRefetch identity changes (same as polling effect).
  useEffect(() => {
    if (agent.registrationState !== "RegistrationFailed") return;
    if (registrationFailedSyncAgentIdRef.current === agent.id) return;
    registrationFailedSyncAgentIdRef.current = agent.id;
    void (async () => {
      await syncAndRefetchRef.current();
    })();
  }, [agent.id, agent.registrationState]);

  // Reconcile pending credentials or backfill on-chain anchors when missing.
  useEffect(() => {
    if (!isAgentVerificationFlowEnabled()) {
      return;
    }
    (async () => {
      const result = await credentialApiClient.reconcilePendingCredentials(
        agent.id,
      );
      if (result.success) {
        await syncAgentRegistrationStatusAction(agent.id);
        const next = await agentApiClient.getAgent(agent.id);
        if (next.success && next.data) setAgent(next.data);
      }
    })().catch(() => {
      // Reconcile or refetch failed; ignore.
    });
  }, [agent.id]);

  const tabParamRaw = searchParams.get("tab");
  const tabParam =
    tabParamRaw === LEGACY_CREDENTIALS_TAB ? VERIFICATION_TAB : tabParamRaw;
  const fromParam = searchParams.get("from");
  const isFromDashboard = fromParam === "dashboard";
  const backHref = isFromDashboard ? "/" : "/ai-agents";
  const backLabel = isFromDashboard ? t("backToDashboard") : undefined;
  const tabs = [
    { name: tTabs("detailTabs.details"), key: "details" },
    { name: tTabs("detailTabs.earnings"), key: "earnings" },
    { name: tTabs("detailTabs.transactions"), key: "transactions" },
  ];
  if (agentVerificationUiEnabled) {
    tabs.push({
      name: tTabs("detailTabs.verification"),
      key: VERIFICATION_TAB,
    });
  }
  const activeTab =
    tabParam && tabs.some((tab) => tab.key === tabParam)
      ? tabParam
      : DEFAULT_TAB;

  const handleTabChange = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleDeregisterConfirm = () => {
    setIsDeregistering(true);
    (async () => {
      try {
        const result = await agentApiClient.deregisterAgent(agent.id);
        if (result.success) {
          toast.success(t("deregisterSuccess"));
          const next = await agentApiClient.getAgent(agent.id);
          if (next.success && next.data) setAgent(next.data);
          setIsDeregisterDialogOpen(false);
        } else {
          toast.error(result.error ?? t("deregisterError"));
        }
      } finally {
        setIsDeregistering(false);
      }
    })().catch(() => {
      // finally already cleared loading; catch only prevents unhandled rejection.
    });
  };

  const handleDeleteConfirm = () => {
    setIsDeleting(true);
    (async () => {
      try {
        const result = await agentApiClient.deleteAgent(agent.id);
        if (result.success) {
          toast.success(t("deleteSuccess"));
          router.push(backHref);
        } else {
          toast.error(result.error || t("deleteError"));
        }
      } finally {
        setIsDeleting(false);
      }
    })().catch(() => {
      // finally already cleared loading; catch only prevents unhandled rejection.
    });
  };

  const handleVerificationSuccess = () => {
    (async () => {
      await credentialApiClient.reconcilePendingCredentials(agent.id);
      await syncAgentRegistrationStatusAction(agent.id);
      const result = await agentApiClient.getAgent(agent.id);
      if (result.success && result.data) setAgent(result.data);
    })().catch(() => {
      // Refetch failed; user can refresh the page.
    });
  };

  return (
    <>
      <div className="flex flex-col gap-8 pb-3 pt-1">
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
          onDeregisterClick={() => setIsDeregisterDialogOpen(true)}
          onVerificationSuccess={handleVerificationSuccess}
        />
      )}

      {agentVerificationUiEnabled && activeTab === VERIFICATION_TAB && (
        <AgentVerificationTab
          agent={agent}
          onVerificationSuccess={handleVerificationSuccess}
        />
      )}

      {activeTab === "earnings" && <AgentEarnings agent={agent} />}

      {activeTab === "transactions" && <AgentTransactions agent={agent} />}

      {agentNetwork && (
        <NetworkMismatchDialog
          open={isNetworkDialogOpen}
          agentNetwork={agentNetwork}
          currentNetwork={network}
          onSwitch={handleSwitchNetwork}
          onBack={handleNetworkDialogBack}
        />
      )}

      <DeregisterAgentDialog
        open={isDeregisterDialogOpen}
        onOpenChange={setIsDeregisterDialogOpen}
        onConfirm={handleDeregisterConfirm}
        agentName={agent.name}
        isLoading={isDeregistering}
      />

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
