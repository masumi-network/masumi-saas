"use client";

import { CircleHelp } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshButton } from "@/components/ui/refresh-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFormatDate } from "@/hooks/use-format-date";
import { type Agent } from "@/lib/api/agent.client";

import { AgentRecentActivityFeed } from "./agent-recent-activity-feed";

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
  const { formatDateTime, formatRelativeDate } = useFormatDate();

  const handleSync = async () => {
    if (!onSyncAgent) return;
    await onSyncAgent();
  };

  const activityRefreshKey = [
    agent.id,
    agent.registrationState,
    agent.updatedAt,
    agent.registrationInitiatedAt ?? "",
    lastRegistrationSyncedAt?.toISOString() ?? "",
  ].join("|");

  const lastSyncedValue =
    showLastSyncedPending || lastRegistrationSyncedAt == null ? (
      <span className="text-xs font-medium tabular-nums text-muted-foreground">
        {t("syncInProgress")}
      </span>
    ) : (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-xs font-medium tabular-nums text-foreground">
            {formatRelativeDate(lastRegistrationSyncedAt)}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end">
          {formatDateTime(lastRegistrationSyncedAt)}
        </TooltipContent>
      </Tooltip>
    );

  return (
    <Card className="overflow-hidden gap-0 py-0">
      <CardHeader className="gap-0 space-y-0 border-b border-border/50 p-0 !pb-0">
        <div className="flex items-center gap-1.5 px-5 py-4">
          <CardTitle className="text-base font-semibold leading-none">
            {t("recentActivity")}
          </CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex shrink-0 cursor-help text-muted-foreground hover:text-foreground">
                <CircleHelp className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">{t("recentActivityHint")}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" className="max-w-xs">
              {t("recentActivityHint")}
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/40 bg-muted/20 px-5 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">
            {t("lastSynced")}
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            {lastSyncedValue}
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
        <div className="px-5 pt-4 pb-4">
          <AgentRecentActivityFeed
            agentId={agent.id}
            refreshKey={activityRefreshKey}
          />
        </div>
      </CardContent>
    </Card>
  );
}
