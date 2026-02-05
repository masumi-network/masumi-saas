"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
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
import { type Agent, agentApiClient } from "@/lib/api/agent.client";

import {
  getRegistrationStatusBadgeVariant,
  parseAgentRegistrationStatus,
} from "./agent-utils";

interface AgentsTableProps {
  agents: Agent[];
  onAgentClick: (agent: Agent) => void;
  onDeleteSuccess: () => void;
}

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
      const result = await agentApiClient.deleteAgent(selectedAgentToDelete.id);
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
            <TableRow className="hover:bg-transparent">
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
                <TableCell className="font-medium max-w-48 truncate text-xs sm:text-sm">
                  {agent.name}
                </TableCell>
                <TableCell className="max-w-48 truncate text-xs sm:text-sm">
                  {agent.description}
                </TableCell>
                <TableCell className="font-mono text-xs sm:text-sm max-w-48 truncate">
                  <Link
                    href={agent.apiUrl}
                    target="_blank"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs sm:text-sm hover:underline text-muted-foreground"
                  >
                    {agent.apiUrl}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={getRegistrationStatusBadgeVariant(
                      agent.registrationState,
                    )}
                  >
                    {parseAgentRegistrationStatus(agent.registrationState)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 overflow-x-auto">
                    {agent.tags.slice(0, 3).map((tag, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="text-xs whitespace-nowrap"
                      >
                        {tag}
                      </Badge>
                    ))}
                    {agent.tags.length > 3 && (
                      <Badge
                        variant="outline"
                        className="text-xs whitespace-nowrap"
                      >
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
