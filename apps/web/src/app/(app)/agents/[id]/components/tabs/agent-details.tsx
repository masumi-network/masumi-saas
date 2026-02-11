"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type Agent } from "@/lib/api/agent.client";
import { formatDate } from "@/lib/utils";

import {
  getRegistrationStatusBadgeVariant,
  parseAgentRegistrationStatus,
} from "../../../components/agent-utils";

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60)
    return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface AgentDetailsProps {
  agent: Agent;
  onDeleteClick: () => void;
}

export function AgentDetails({ agent, onDeleteClick }: AgentDetailsProps) {
  const t = useTranslations("App.Agents.Details");

  return (
    <div className="w-full max-w-3xl space-y-8">
      <div className="flex flex-col gap-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <CardTitle className="text-sm font-medium">
                {t("description")}
              </CardTitle>
              <Badge
                variant={getRegistrationStatusBadgeVariant(
                  agent.registrationState,
                )}
                className="w-fit min-w-fit"
              >
                {parseAgentRegistrationStatus(agent.registrationState)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p
              className={
                agent.description
                  ? "text-sm text-muted-foreground"
                  : "text-sm text-muted-foreground italic"
              }
            >
              {agent.description || t("noDescription")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("apiUrl")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-row items-center justify-between py-2 gap-2 bg-muted/40 p-2 rounded-lg border w-full min-w-0">
              <span className="text-sm text-muted-foreground shrink-0">
                {t("endpoint")}
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto min-w-0 justify-end">
                <Link
                  href={agent.apiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs sm:text-sm hover:underline truncate max-w-48 sm:max-w-72 lg:max-w-96 inline-flex items-center gap-1"
                >
                  {agent.apiUrl}
                </Link>
                <CopyButton value={agent.apiUrl} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("tags")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {agent.tags && agent.tags.length > 0 ? (
                agent.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">
                  {t("noTags")}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            {t("additionalDetails")}
          </span>
          <Separator className="flex-1" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {t("metadata")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">
                {t("createdAt")}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm font-medium cursor-default">
                    {formatRelativeDate(agent.createdAt)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{formatDate(agent.createdAt)}</TooltipContent>
              </Tooltip>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">
                {t("updatedAt")}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm font-medium cursor-default">
                    {formatRelativeDate(agent.updatedAt)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{formatDate(agent.updatedAt)}</TooltipContent>
              </Tooltip>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            {t("dangerZone")}
          </span>
          <Separator className="flex-1" />
        </div>
        <Card>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-2">
              <div className="min-w-0">
                <p className="font-medium text-sm">{t("delete")}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t("deleteDescription")}
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={onDeleteClick}
                className="gap-2 shrink-0 w-full sm:w-auto"
              >
                <Trash2 className="h-4 w-4" />
                {t("delete")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
