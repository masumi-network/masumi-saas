"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteAgentAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

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

interface AgentsTableProps {
  agents: Agent[];
  onAgentClick: (agent: Agent) => void;
  onDeleteSuccess: () => void;
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

export function AgentsTable({
  agents,
  onAgentClick,
  onDeleteSuccess,
}: AgentsTableProps) {
  const t = useTranslations("App.Agents");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAgentToDelete, setSelectedAgentToDelete] =
    useState<Agent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [, startTransition] = useTransition();

  const handleDeleteClick = (e: React.MouseEvent, agent: Agent) => {
    e.stopPropagation();
    setSelectedAgentToDelete(agent);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!selectedAgentToDelete) return;

    setIsDeleting(true);
    startTransition(async () => {
      const result = await deleteAgentAction(selectedAgentToDelete.id);
      if (result.success) {
        toast.success(t("deleteSuccess"));
        onDeleteSuccess();
        setIsDeleteDialogOpen(false);
        setSelectedAgentToDelete(null);
      } else {
        toast.error(result.error || t("deleteError"));
      }
      setIsDeleting(false);
    });
  };

  if (agents.length === 0) {
    return null;
  }

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.name")}</TableHead>
              <TableHead>{t("table.description")}</TableHead>
              <TableHead>{t("table.apiUrl")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead>{t("table.tags")}</TableHead>
              <TableHead className="text-right sticky right-0 z-10 w-48 min-w-48 bg-gradient-to-r from-transparent via-background/80 to-background">
                {t("table.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => (
              <TableRow
                key={agent.id}
                className="cursor-pointer hover:bg-muted/50 group"
                onClick={() => onAgentClick(agent)}
              >
                <TableCell className="font-medium">{agent.name}</TableCell>
                <TableCell className="max-w-md truncate">
                  {agent.description}
                </TableCell>
                <TableCell className="font-mono text-sm max-w-xs truncate">
                  {agent.apiUrl}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={getStatusBadgeVariant(agent.verificationStatus)}
                    className={cn(
                      agent.verificationStatus === "APPROVED" &&
                        "bg-green-500 text-white hover:bg-green-500/80",
                    )}
                  >
                    {getStatusLabel(agent.verificationStatus, t)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {agent.tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {agent.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        {"+"}
                        {agent.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right sticky right-0 z-10 w-48 min-w-48 bg-gradient-to-r from-transparent via-background/80 to-background">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDeleteClick(e, agent)}
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription", {
          name: selectedAgentToDelete?.name || "",
        })}
        confirmText={t("delete")}
        cancelText={t("cancel")}
        isLoading={isDeleting}
        variant="destructive"
      />
    </>
  );
}
