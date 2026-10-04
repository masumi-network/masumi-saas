"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { AgentIcon } from "@/components/agent-icon";
import { AgentVerificationShieldIndicator } from "@/components/agent-verification-shield-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/ui/refresh-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  isRegistrationConfirmedOnNetwork,
  isRegistrationUiPending,
} from "@/lib/agents/registration-state";
import { type Agent } from "@/lib/api/agent.client";
import { cn } from "@/lib/utils";

import { AgentRegistryVersionBadge } from "../../components/agent-registry-version-badge";
import {
  getRegistrationStatusBadgeClassName,
  getRegistrationStatusBadgeVariant,
  getRegistrationStatusDisplayKey,
} from "../../components/agent-utils";

interface AgentPageHeaderProps {
  agent: Agent;
  backHref?: string;
  backLabel?: string;
  onRefreshRegistrationStatus?: () => void | Promise<void>;
}

export function AgentPageHeader({
  agent,
  backHref = "/ai-agents",
  backLabel,
  onRefreshRegistrationStatus,
}: AgentPageHeaderProps) {
  const tDetails = useTranslations("App.Agents.Details");
  const tSidebar = useTranslations("App.Sidebar.MenuItems");
  const tRegistrationStatus = useTranslations("App.Agents.registrationStatus");

  const label = backLabel ?? tDetails("backToAgents");
  const breadcrumbLabel =
    backHref === "/" ? tSidebar("dashboard") : tSidebar("agents");

  const isRegistrationConfirmed = isRegistrationConfirmedOnNetwork(
    agent.registrationState,
  );
  const registrationBadgeVariant = isRegistrationConfirmed
    ? ("success" as const)
    : getRegistrationStatusBadgeVariant(agent.registrationState);
  const registrationStatusPending = isRegistrationUiPending(
    agent.registrationState,
  );
  const showRegistrationRefresh =
    Boolean(onRefreshRegistrationStatus) && registrationStatusPending;

  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const handleRefreshStatus = useCallback(async () => {
    if (!onRefreshRegistrationStatus) return;
    setIsRefreshingStatus(true);
    try {
      await onRefreshRegistrationStatus();
    } finally {
      setIsRefreshingStatus(false);
    }
  }, [onRefreshRegistrationStatus]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              asChild
              className="h-8 w-8 shrink-0 rounded-full -ml-2"
            >
              <Link href={backHref}>
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
        <Link
          href={backHref}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {breadcrumbLabel}
        </Link>
      </div>
      <div className="flex flex-wrap items-start gap-3 min-w-0">
        <AgentIcon
          icon={agent.icon}
          name={agent.name}
          className="size-8 shrink-0 mt-0.5"
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
            <h1 className="min-w-0 max-w-full truncate text-page-title font-semibold tracking-tight">
              {agent.name}
            </h1>
            <AgentRegistryVersionBadge
              agentIdentifier={agent.agentIdentifier}
            />
            <Badge
              variant={registrationBadgeVariant}
              className={cn(
                "shrink-0",
                getRegistrationStatusBadgeClassName(agent.registrationState),
              )}
            >
              {tRegistrationStatus(
                getRegistrationStatusDisplayKey(agent.registrationState),
              )}
            </Badge>
            {showRegistrationRefresh ? (
              <RefreshButton
                onRefresh={handleRefreshStatus}
                isRefreshing={isRefreshingStatus}
                buttonVariant="ghost"
                size="sm"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={tDetails("refresh")}
              />
            ) : null}
            {agent.verificationStatus === "VERIFIED" ? (
              <AgentVerificationShieldIndicator
                agentId={agent.id}
                dbVerificationStatus={agent.verificationStatus}
                registered={agent.registrationState === "RegistrationConfirmed"}
                size="md"
                className="-mt-0.5 shrink-0"
              />
            ) : null}
          </div>
          {registrationStatusPending ? (
            <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
              {tDetails("registrationStatusPendingHint")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
