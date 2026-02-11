"use client";

import { ChevronLeft, ShieldCheck, ShieldOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/ui/refresh-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type Agent } from "@/lib/api/agent.client";

import { parseVerificationStatus } from "../../components/agent-utils";

interface AgentPageHeaderProps {
  agent: Agent;
}

export function AgentPageHeader({ agent }: AgentPageHeaderProps) {
  const tDetails = useTranslations("App.Agents.Details");
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    router.refresh();
    await new Promise((r) => setTimeout(r, 400));
    setIsRefreshing(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            asChild
            className="-ml-2 rounded-full shrink-0"
          >
            <Link href="/agents">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tDetails("backToAgents")}</TooltipContent>
      </Tooltip>
      <h1 className="text-2xl font-light tracking-tight truncate min-w-0">
        {agent.name}
      </h1>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="shrink-0 inline-flex text-muted-foreground cursor-default">
            {agent.verificationStatus === "VERIFIED" ? (
              <ShieldCheck className="h-5 w-5" />
            ) : (
              <ShieldOff className="h-5 w-5" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {parseVerificationStatus(agent.verificationStatus)}
        </TooltipContent>
      </Tooltip>
      <RefreshButton
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        size="md"
        className="ml-auto shrink-0"
        aria-label={tDetails("refresh")}
      />
    </div>
  );
}
