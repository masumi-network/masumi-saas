"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { AgentIcon } from "@/components/agent-icon";
import { AgentVerificationShieldIndicator } from "@/components/agent-verification-shield-indicator";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isRegistrationUiPending } from "@/lib/agents/registration-state";
import { type Agent } from "@/lib/api/agent.client";

import { AgentRegistryVersionBadge } from "../../components/agent-registry-version-badge";

interface AgentPageHeaderProps {
  agent: Agent;
  backHref?: string;
  backLabel?: string;
}

export function AgentPageHeader({
  agent,
  backHref = "/ai-agents",
  backLabel,
}: AgentPageHeaderProps) {
  const tDetails = useTranslations("App.Agents.Details");
  const tSidebar = useTranslations("App.Sidebar.MenuItems");

  const label = backLabel ?? tDetails("backToAgents");
  const breadcrumbLabel =
    backHref === "/" ? tSidebar("dashboard") : tSidebar("agents");

  const registrationStatusPending = isRegistrationUiPending(
    agent.registrationState,
  );

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
