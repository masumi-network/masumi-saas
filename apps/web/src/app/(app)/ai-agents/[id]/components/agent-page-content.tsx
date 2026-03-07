"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Tabs } from "@/components/ui/tabs";
import {
  deregisterAgentAction,
  syncAgentRegistrationStatusAction,
} from "@/lib/actions/agent.action";
import { type Agent, agentApiClient } from "@/lib/api/agent.client";
import { credentialApiClient } from "@/lib/api/credential.client";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import type { PaymentNodeNetwork } from "@/lib/payment-node";

import { AgentPageHeader } from "./agent-page-header";
import { DeleteAgentDialog } from "./delete-agent-dialog";
import { DeregisterAgentDialog } from "./deregister-agent-dialog";
import { NetworkMismatchDialog } from "./network-mismatch-dialog";
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeregisterDialogOpen, setIsDeregisterDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeregistering, setIsDeregistering] = useState(false);
  const [, startTransition] = useTransition();

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

  const pendingRegistration =
    agent.registrationState === "RegistrationRequested" ||
    agent.registrationState === "RegistrationInitiated" ||
    agent.registrationState === "DeregistrationRequested" ||
    agent.registrationState === "DeregistrationInitiated";

  // RegistrationFailed may eventually have an agentIdentifier populated on the
  // payment node (the tx can land on-chain after the initial failure response).
  // Run one sync on mount so we pick it up without continuous polling.
  const syncAndRefetch = useCallback(async () => {
    await syncAgentRegistrationStatusAction(agent.id);
    const result = await agentApiClient.getAgent(agent.id);
    if (result.success && result.data) setAgent(result.data);
  }, [agent.id]);

  // Ref: we only run the RegistrationFailed one-time sync once per agent, so when
  // syncAndRefetch updates agent and the effect re-runs we don't sync again.
  const registrationFailedSyncAgentIdRef = useRef<string | null>(null);

  const pollTimeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll while pending: one run then chain next every 12s (no setInterval to avoid overlapping async calls).
  useEffect(() => {
    if (!pendingRegistration) return;
    let cancelled = false;
    const scheduleNext = () => {
      if (cancelled) return;
      pollTimeoutIdRef.current = setTimeout(() => {
        if (cancelled) return;
        void (async () => {
          await syncAndRefetch();
          if (cancelled) return;
          scheduleNext();
        })();
      }, 12_000);
    };
    void (async () => {
      await syncAndRefetch();
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
  }, [pendingRegistration, syncAndRefetch]);

  // One-time sync for RegistrationFailed (tx may land on-chain after initial failure).
  useEffect(() => {
    if (agent.registrationState !== "RegistrationFailed") return;
    if (registrationFailedSyncAgentIdRef.current === agent.id) return;
    registrationFailedSyncAgentIdRef.current = agent.id;
    void (async () => {
      await syncAndRefetch();
    })();
  }, [agent.id, agent.registrationState, syncAndRefetch]);

  // Silently reconcile any PENDING credentials on mount.
  // Handles the case where the user accepted the credential in Veridian
  // after the dialog was closed or the page was reloaded.
  useEffect(() => {
    if (agent.verificationStatus === "VERIFIED") return;
    void (async () => {
      const result = await credentialApiClient.reconcilePendingCredentials(
        agent.id,
      );
      if (result.success && result.data.resolved) {
        const next = await agentApiClient.getAgent(agent.id);
        if (next.success && next.data) setAgent(next.data);
      }
    })();
  }, [agent.id, agent.verificationStatus]);

  const tabParam = searchParams.get("tab");
  const fromParam = searchParams.get("from");
  const activeTab = isValidTab(tabParam) ? tabParam : DEFAULT_TAB;

  const isFromDashboard = fromParam === "dashboard";
  const backHref = isFromDashboard ? "/" : "/ai-agents";
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

  const handleDeregisterConfirm = () => {
    setIsDeregistering(true);
    startTransition(async () => {
      const result = await deregisterAgentAction(agent.id);
      if (result.success) {
        toast.success(t("deregisterSuccess"));
        const next = await agentApiClient.getAgent(agent.id);
        if (next.success && next.data) setAgent(next.data);
        setIsDeregisterDialogOpen(false);
      } else {
        toast.error(result.error ?? t("deregisterError"));
      }
      setIsDeregistering(false);
    });
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

      {activeTab === "credentials" && (
        <AgentCredentials
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
