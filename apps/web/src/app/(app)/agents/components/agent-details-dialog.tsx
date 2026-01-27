"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  deleteAgentAction,
} from "@/lib/actions";
import { cn } from "@/lib/utils";

import { AgentVerificationCard } from "./agent-verification-card";

type Agent = {
  id: string;
  name: string;
  description: string;
  apiUrl: string;
  tags: string[];
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW" | null;
  createdAt: Date;
  updatedAt: Date;
};

interface AgentDetailsDialogProps {
  agent: Agent | null;
  onClose: () => void;
  onDeleteSuccess: () => void;
  onVerificationSuccess: () => void;
}

const getStatusBadgeVariant = (
  status: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW" | null,
): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "APPROVED") return "default";
  if (status === "REJECTED") return "destructive";
  if (status === "REVIEW") return "default";
  return "secondary";
};

const getStatusLabel = (
  status: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW" | null,
  t: (key: string) => string,
): string => {
  if (status === "APPROVED") return t("status.verified");
  if (status === "REJECTED") return t("status.rejected");
  if (status === "REVIEW") return t("status.underReview");
  return t("status.pending");
};

export function AgentDetailsDialog({
  agent,
  onClose,
  onDeleteSuccess,
  onVerificationSuccess,
}: AgentDetailsDialogProps) {
  const t = useTranslations("App.Agents.Details");
  const tStatus = useTranslations("App.Agents");
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
      const result = await deleteAgentAction(agent.id);
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DialogTitle className="text-xl">{agent.name}</DialogTitle>
                <DialogDescription className="mt-2">
                  {agent.description}
                </DialogDescription>
              </div>
              <Badge
                variant={getStatusBadgeVariant(agent.verificationStatus)}
                className={cn(
                  agent.verificationStatus === "APPROVED" &&
                    "bg-green-500 text-white hover:bg-green-500/80",
                  "ml-4",
                )}
              >
                {getStatusLabel(agent.verificationStatus, tStatus)}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <AgentVerificationCard
              agent={agent}
              onVerificationSuccess={onVerificationSuccess}
            />

            <Separator />

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {t("apiUrl")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-2 p-2 bg-muted/40 rounded-lg border">
                  <span className="text-sm text-muted-foreground font-mono truncate flex-1">
                    {agent.apiUrl}
                  </span>
                  <CopyButton value={agent.apiUrl} />
                </div>
              </CardContent>
            </Card>

            {agent.tags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    {t("tags")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {agent.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

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
