"use client";

import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  agentApiClient,
  type AgentOnChainVerificationStatus,
} from "@/lib/api/agent.client";
import { verifiableCredentialsSdkDocUrl } from "@/lib/config/verification.config";
import { deriveVerificationPresentation } from "@/lib/registry/verification-display";
import { cn } from "@/lib/utils";

const sizeClass = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
} as const;

/**
 * Green shield next to an agent name only when verification is confirmed
 * on-chain. No badge while updates or DB-only verification are pending.
 */
export function AgentVerificationShieldIndicator({
  agentId,
  dbVerificationStatus,
  registered,
  className,
  size = "sm",
}: {
  agentId: string;
  dbVerificationStatus: string | null | undefined;
  registered: boolean;
  className?: string;
  size?: keyof typeof sizeClass;
}) {
  const t = useTranslations("App.Agents.status");
  const dbStatus = dbVerificationStatus || "PENDING";
  const shouldFetchOnChain = registered && dbStatus === "VERIFIED";

  const [onChainStatus, setOnChainStatus] =
    useState<AgentOnChainVerificationStatus | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!shouldFetchOnChain) return;

    let cancelled = false;

    async function fetchStatus() {
      setLoaded(false);
      const res = await agentApiClient.getOnChainVerificationStatus(agentId);
      if (cancelled) return;
      setOnChainStatus(res.success ? res.data : null);
      setLoaded(true);
    }

    fetchStatus();

    return () => {
      cancelled = true;
    };
  }, [agentId, shouldFetchOnChain]);

  if (!shouldFetchOnChain || !loaded) return null;

  const presentation = deriveVerificationPresentation({
    dbStatus,
    onChain: onChainStatus,
  });

  if (presentation !== "verifiedOnChain") return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex shrink-0 cursor-default touch-manipulation items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className,
          )}
        >
          <ShieldCheck
            className={cn(
              sizeClass[size],
              "text-green-600 dark:text-green-500",
            )}
            aria-hidden
          />
          <span className="sr-only">{t("verifiedShieldAriaSummary")}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {t.rich("verifiedShieldTooltip", {
          docsLink: (chunks) => (
            <a
              href={verifiableCredentialsSdkDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              onPointerDown={(event) => event.stopPropagation()}
            >
              {chunks}
            </a>
          ),
        })}
      </TooltipContent>
    </Tooltip>
  );
}
