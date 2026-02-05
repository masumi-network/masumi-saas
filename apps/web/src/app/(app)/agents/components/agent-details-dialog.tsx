"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { type Agent, agentApiClient } from "@/lib/api/agent.client";

import { AgentVerificationCard } from "./agent-verification-card";

const parseAgentRegistrationStatus = (
  status: Agent["registrationState"],
): string => {
  switch (status) {
    case "RegistrationRequested":
      return "Pending";
    case "RegistrationInitiated":
      return "Registering";
    case "RegistrationConfirmed":
      return "Registered";
    case "RegistrationFailed":
      return "Registration Failed";
    case "DeregistrationRequested":
      return "Pending";
    case "DeregistrationInitiated":
      return "Deregistering";
    case "DeregistrationConfirmed":
      return "Deregistered";
    case "DeregistrationFailed":
      return "Deregistration Failed";
    default:
      return status;
  }
};

const getRegistrationStatusBadgeVariant = (
  status: Agent["registrationState"],
) => {
  if (status === "RegistrationConfirmed") return "default";
  if (status.includes("Failed")) return "destructive";
  if (status.includes("Initiated")) return "secondary";
  if (status.includes("Requested")) return "secondary";
  if (status === "DeregistrationConfirmed") return "secondary";
  return "secondary";
};

interface AgentDetailsDialogProps {
  agent: Agent | null;
  onClose: () => void;
  onDeleteSuccess: () => void;
  onVerificationSuccess: () => void;
}

export function AgentDetailsDialog({
  agent,
  onClose,
  onDeleteSuccess,
  onVerificationSuccess,
}: AgentDetailsDialogProps) {
  const t = useTranslations("App.Agents.Details");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [, startTransition] = useTransition();

  if (!agent) {
    return null;
  }

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    setIsDeleting(true);
    startTransition(async () => {
      const result = await agentApiClient.deleteAgent(agent.id);
      if (result.success) {
        toast.success(t("deleteSuccess"));
        onDeleteSuccess();
        setIsDeleteDialogOpen(false);
        onClose();
      } else {
        toast.error(result.error || t("deleteError"));
      }
      setIsDeleting(false);
    });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <>
      <Dialog open={!!agent} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl px-0 max-h-dialog overflow-y-auto">
          <DialogHeader className="px-6">
            <DialogTitle>{agent.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4 px-6">
            <div className="flex items-start justify-between w-full gap-4">
              <div className="flex-1">
                <h3 className="font-medium mb-2">{t("description")}</h3>
                <p className="text-sm text-muted-foreground">
                  {agent.description || t("noDescription")}
                </p>
              </div>
              <Badge
                variant={getRegistrationStatusBadgeVariant(
                  agent.registrationState,
                )}
                className="w-fit min-w-fit"
              >
                {parseAgentRegistrationStatus(agent.registrationState)}
              </Badge>
            </div>

            <AgentVerificationCard
              agent={agent}
              onVerificationSuccess={onVerificationSuccess}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {t("apiUrl")}
                </CardTitle>
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
                      className="font-mono text-xs sm:text-sm hover:underline text-primary truncate max-w-36 sm:max-w-48 lg:max-w-60 xl:max-w-72"
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
                <CardTitle className="text-sm font-medium">
                  {t("tags")}
                </CardTitle>
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

            <div className="flex items-center gap-4 pt-2">
              <Separator className="flex-1" />
              <h3 className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                {t("additionalDetails")}
              </h3>
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

            <div className="flex justify-end pt-4 border-t">
              <Button
                variant="destructive"
                onClick={handleDeleteClick}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {t("delete")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription", { name: agent.name })}
        confirmText={t("delete")}
        cancelText={t("cancel")}
        isLoading={isDeleting}
        variant="destructive"
      />
    </>
  );
}
