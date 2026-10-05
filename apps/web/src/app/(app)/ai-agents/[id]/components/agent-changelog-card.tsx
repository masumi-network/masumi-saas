"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshButton } from "@/components/ui/refresh-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFormatDate } from "@/hooks/use-format-date";
import { isRegistrationConfirmedOnNetwork } from "@/lib/agents/registration-state";
import { type Agent } from "@/lib/api/agent.client";
import { cn } from "@/lib/utils";

import {
  getRegistrationStatusBadgeClassName,
  getRegistrationStatusBadgeVariant,
  getRegistrationStatusDisplayKey,
} from "../../components/agent-utils";
import { AgentRegistrationStatusTimeline } from "./agent-registration-status-timeline";

type AgentChangelogCardProps = {
  agent: Agent;
  lastRegistrationSyncedAt: Date | null;
  showLastSyncedPending: boolean;
  isSyncingAgent: boolean;
  onSyncAgent?: () => void | Promise<void>;
};

export function AgentChangelogCard({
  agent,
  lastRegistrationSyncedAt,
  showLastSyncedPending,
  isSyncingAgent,
  onSyncAgent,
}: AgentChangelogCardProps) {
  const t = useTranslations("App.Agents.Details");
  const tRegistrationStatus = useTranslations("App.Agents.registrationStatus");
  const { formatDateTime, formatRelativeDate } = useFormatDate();

  const isRegistrationConfirmed = isRegistrationConfirmedOnNetwork(
    agent.registrationState,
  );
  const registrationBadgeVariant = isRegistrationConfirmed
    ? ("success" as const)
    : getRegistrationStatusBadgeVariant(agent.registrationState);

  const handleSync = async () => {
    if (!onSyncAgent) return;
    await onSyncAgent();
  };

  return (
    <Card className="overflow-hidden gap-0 py-0">
      <CardHeader className="gap-0 space-y-0 border-b border-border/50 p-0 !pb-0">
        <div className="px-5 py-4">
          <CardTitle className="text-base font-semibold leading-none">
            {t("changelog")}
          </CardTitle>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/40 bg-muted/20 px-5 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">
            {t("registryStatusLabel")}
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            <Badge
              variant={registrationBadgeVariant}
              className={cn(
                "text-xs",
                getRegistrationStatusBadgeClassName(agent.registrationState),
              )}
            >
              {tRegistrationStatus(
                getRegistrationStatusDisplayKey(agent.registrationState),
              )}
            </Badge>
            {onSyncAgent ? (
              <RefreshButton
                onRefresh={handleSync}
                isRefreshing={isSyncingAgent}
                buttonVariant="ghost"
                size="sm"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={t("refresh")}
              />
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-0 p-0">
        <div className="px-5 py-4">
          <AgentRegistrationStatusTimeline agent={agent} />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/40 bg-muted/10 px-5 py-3">
          <span className="text-xs text-muted-foreground">
            {t("lastSynced")}
          </span>
          {showLastSyncedPending ? (
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {t("syncInProgress")}
            </span>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-xs font-medium tabular-nums text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                >
                  {formatRelativeDate(lastRegistrationSyncedAt)}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end">
                {formatDateTime(lastRegistrationSyncedAt)}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
