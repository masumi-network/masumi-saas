"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type Agent } from "@/lib/api/agent.client";

import { AgentIcon } from "../../components/agent-icon";
import {
  getRegistrationStatusBadgeVariant,
  getRegistrationStatusKey,
} from "../../components/agent-utils";

interface AgentPageHeaderProps {
  agent: Agent;
  backHref?: string;
  backLabel?: string;
}

export function AgentPageHeader({
  agent,
  backHref = "/agents",
  backLabel,
}: AgentPageHeaderProps) {
  const tDetails = useTranslations("App.Agents.Details");
  const tRegistrationStatus = useTranslations("App.Agents.registrationStatus");
  const tSidebar = useTranslations("App.Sidebar.MenuItems");

  const label = backLabel ?? tDetails("backToAgents");
  const breadcrumbLabel =
    backHref === "/" ? tSidebar("dashboard") : tSidebar("agents");

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
      <div className="flex flex-wrap items-center gap-3">
        <AgentIcon
          icon={agent.icon}
          name={agent.name}
          className="size-8 shrink-0"
        />
        <h1 className="text-2xl font-light tracking-tight truncate min-w-0">
          {agent.name}
        </h1>
        <Badge
          variant={
            agent.registrationState === "RegistrationConfirmed"
              ? "success"
              : getRegistrationStatusBadgeVariant(agent.registrationState)
          }
          className="shrink-0"
        >
          {tRegistrationStatus(
            getRegistrationStatusKey(agent.registrationState),
          )}
        </Badge>
      </div>
    </div>
  );
}
