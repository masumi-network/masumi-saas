"use client";

import { useQuery } from "@tanstack/react-query";

import {
  agentApiClient,
  type AgentOnChainVerificationStatus,
} from "@/lib/api/agent.client";
import { deriveVerificationPresentation } from "@/lib/registry/verification-display";

/** Stable key for invalidation after verification / registry updates. */
export function agentOnChainVerificationQueryKey(agentId: string) {
  return ["agents", agentId, "on-chain-verification"] as const;
}

/** On-chain reads are slow (payment node + Keria). Cache longer once verified. */
const VERIFIED_STALE_MS = 10 * 60_000;
const DEFAULT_STALE_MS = 60_000;
const PROGRESS_POLL_MS = 12_000;

function staleTimeForStatus(
  data: AgentOnChainVerificationStatus | undefined,
): number {
  if (data?.verified && data.resolutionSource === "on-chain") {
    return VERIFIED_STALE_MS;
  }
  return DEFAULT_STALE_MS;
}

type UseAgentOnChainVerificationOptions = {
  enabled?: boolean;
  /** Used to keep polling while registry update / on-chain backfill is in flight. */
  dbStatus?: string;
  registrationState?: string | null;
};

export function useAgentOnChainVerificationStatus(
  agentId: string,
  options: UseAgentOnChainVerificationOptions = {},
) {
  const {
    enabled = true,
    dbStatus = "PENDING",
    registrationState = null,
  } = options;

  return useQuery({
    queryKey: agentOnChainVerificationQueryKey(agentId),
    enabled: enabled && Boolean(agentId),
    queryFn: async (): Promise<AgentOnChainVerificationStatus> => {
      const res = await agentApiClient.getOnChainVerificationStatus(agentId);
      if (!res.success) {
        throw new Error(res.error ?? "Failed to load on-chain verification");
      }
      return res.data;
    },
    staleTime: (query) => staleTimeForStatus(query.state.data),
    gcTime: 30 * 60_000,
    refetchInterval: (query) => {
      const presentation = deriveVerificationPresentation({
        dbStatus,
        onChain: query.state.data ?? null,
        registrationState,
      });
      if (
        presentation === "updateInProgress" ||
        presentation === "onChainPending"
      ) {
        return PROGRESS_POLL_MS;
      }
      return false;
    },
    // Show the last known badge/status immediately while a background refetch runs.
    placeholderData: (previous) => previous,
  });
}
