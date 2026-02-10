"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Separator } from "@/components/ui/separator";
import { type Agent } from "@/lib/api/agent.client";

import {
  getRegistrationStatusBadgeVariant,
  parseAgentRegistrationStatus,
} from "../../../components/agent-utils";

interface AgentDetailsProps {
  agent: Agent;
  onDeleteClick: () => void;
}

export function AgentDetails({ agent, onDeleteClick }: AgentDetailsProps) {
  const t = useTranslations("App.Agents.Details");

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="w-full max-w-3xl space-y-6">
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
          <p className="text-sm text-muted-foreground">
            {agent.description || t("noDescription")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t("apiUrl")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-2 gap-2 bg-muted/40 p-2 rounded-lg border w-full truncate">
            <span className="text-sm text-muted-foreground min-w-fit">
              {t("endpoint")}
            </span>
            <div className="flex items-center gap-2 w-full justify-end">
              <Link
                href={agent.apiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs sm:text-sm hover:underline text-primary truncate max-w-48 sm:max-w-72 lg:max-w-96"
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
              agent.tags.map((tag, index) => (
                <Badge key={index} variant="secondary">
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
              <span className="text-sm font-medium">
                {formatDate(agent.createdAt)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">
                {t("updatedAt")}
              </span>
              <span className="text-sm font-medium">
                {formatDate(agent.updatedAt)}
              </span>
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
        <div className="flex justify-end pt-2">
          <Button
            variant="destructive"
            onClick={onDeleteClick}
            className="gap-2 w-full"
          >
            <Trash2 className="h-4 w-4" />
            {t("delete")}
          </Button>
        </div>
      </div>
    </div>
  );
}
