"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFormatDate } from "@/hooks/use-format-date";
import { type Agent, agentApiClient } from "@/lib/api/agent.client";
import { isAgentVerificationFlowEnabled } from "@/lib/config/verification.config";
import { useAgentOnChainVerificationStatus } from "@/lib/hooks/use-agent-on-chain-verification";
import {
  deriveVerificationPresentation,
  type VerificationPresentation,
} from "@/lib/registry/verification-display";
import { cn } from "@/lib/utils";

function overviewTone(presentation: VerificationPresentation): string {
  switch (presentation) {
    case "verifiedOnChain":
      return "text-green-600 dark:text-green-500";
    case "updateInProgress":
    case "onChainPending":
      return "text-amber-600 dark:text-amber-500";
    case "revoked":
    case "expired":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

function credentialAnchorAt(
  credential:
    | {
        issuedAt: string;
        lastUpdatedAt: string;
        revokedAt: string | null;
        expiresAt: string | null;
      }
    | null
    | undefined,
  presentation: VerificationPresentation,
): string | null {
  if (!credential) return null;
  if (presentation === "revoked") {
    return credential.revokedAt ?? credential.lastUpdatedAt;
  }
  if (presentation === "expired") {
    return credential.expiresAt ?? credential.lastUpdatedAt;
  }
  return credential.issuedAt ?? credential.lastUpdatedAt;
}

type AgentVerificationOverviewLineProps = {
  agent: Agent;
};

export function AgentVerificationOverviewLine({
  agent,
}: AgentVerificationOverviewLineProps) {
  const t = useTranslations("App.Agents.Details.verificationOverview");
  const { formatDate, formatRelativeDate } = useFormatDate();
  const enabled = isAgentVerificationFlowEnabled();

  const dbStatus = agent.verificationStatus ?? "PENDING";
  const needsCredentialTiming =
    dbStatus === "VERIFIED" || dbStatus === "EXPIRED" || dbStatus === "REVOKED";

  const { data: onChain, isLoading: isLoadingOnChain } =
    useAgentOnChainVerificationStatus(agent.id, {
      enabled,
      dbStatus,
      registrationState: agent.registrationState,
    });

  const { data: credential, isLoading: isLoadingCredential } = useQuery({
    queryKey: ["agents", agent.id, "verification-credential-summary"],
    queryFn: async () => {
      const res = await agentApiClient.getVerificationCredentialSummary(
        agent.id,
      );
      if (!res.success) {
        throw new Error(res.error ?? "Failed to load credential summary");
      }
      return res.data;
    },
    enabled: enabled && needsCredentialTiming,
    staleTime: 60_000,
  });

  const presentation = deriveVerificationPresentation({
    dbStatus,
    onChain: onChain ?? null,
    registrationState: agent.registrationState,
  });

  const isLoading =
    isLoadingOnChain || (needsCredentialTiming && isLoadingCredential);

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner size={14} />
        {t("loading")}
      </span>
    );
  }

  const anchorAt = credentialAnchorAt(credential, presentation);
  const relativeTime = anchorAt ? formatRelativeDate(anchorAt) : null;
  const absoluteTime = anchorAt ? formatDate(anchorAt) : null;

  let message: string;
  switch (presentation) {
    case "verifiedOnChain":
      message = relativeTime
        ? t("verifiedOnChain", { timeAgo: relativeTime })
        : t("verifiedOnChainNoTime");
      break;
    case "updateInProgress":
      message = t("updateInProgress");
      break;
    case "onChainPending":
      message = t("onChainPending");
      break;
    case "revoked":
      message = relativeTime
        ? t("revoked", { timeAgo: relativeTime })
        : t("revokedNoTime");
      break;
    case "expired":
      message = relativeTime
        ? t("expired", { timeAgo: relativeTime })
        : t("expiredNoTime");
      break;
    default:
      message = t("pending");
  }

  const content = (
    <span className={cn("text-sm leading-snug", overviewTone(presentation))}>
      {message}
    </span>
  );

  if (!absoluteTime) {
    return content;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-default">{content}</span>
      </TooltipTrigger>
      <TooltipContent>{absoluteTime}</TooltipContent>
    </Tooltip>
  );
}
