"use client";

import { Trash2 } from "lucide-react";
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
            <div>
              <h3 className="font-medium mb-2">{t("description")}</h3>
              <p className="text-sm text-muted-foreground">
                {agent.description || t("noDescription")}
              </p>
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
                <div className="flex items-center justify-between py-2 gap-2 bg-muted/40 p-2 rounded-lg border">
                  <span className="text-sm text-muted-foreground">
                    {t("endpoint")}
                  </span>
                  <div className="font-mono text-sm flex items-center gap-2 truncate">
                    <a
                      href={agent.apiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline text-primary truncate"
                    >
                      {agent.apiUrl}
                    </a>
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
