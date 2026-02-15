"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
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
  cn,
  formatPricingDisplay,
  formatRelativeDate,
  shortenAddress,
  stripHtml,
} from "@/lib/utils";

import { DeleteAgentDialog } from "../[id]/components/delete-agent-dialog";
import {
  getRegistrationStatusBadgeVariant,
  getRegistrationStatusKey,
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
  const tRegistrationStatus = useTranslations("App.Agents.registrationStatus");
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
              <TableHead>{t("table.added")}</TableHead>
              <TableHead>{t("table.agentId")}</TableHead>
              <TableHead>{t("table.price")}</TableHead>
              <TableHead>{t("table.apiUrl")}</TableHead>
              <TableHead>{t("table.tags")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
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
                <TableCell className="max-w-52">
                  <div className="text-sm font-medium truncate">
                    {agent.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {agent.summary ??
                      (agent.description
                        ? stripHtml(agent.description)
                        : undefined)}
                  </div>
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">
                  {formatRelativeDate(agent.createdAt)}
                </TableCell>
                <TableCell>
                  <div
                    className="text-xs font-mono truncate max-w-44 flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="truncate">
                      {shortenAddress(agent.agentIdentifier ?? agent.id, 6)}
                    </span>
                    <CopyButton
                      value={agent.agentIdentifier ?? agent.id}
                      className="h-7 w-7 shrink-0"
                    />
                  </div>
                </TableCell>
                <TableCell className="text-sm truncate max-w-32 whitespace-nowrap">
                  {formatPricingDisplay(agent.pricing)}
                </TableCell>
                <TableCell>
                  <div
                    className="text-xs font-mono truncate max-w-52 flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link
                      href={agent.apiUrl}
                      target="_blank"
                      className="truncate hover:underline text-muted-foreground"
                    >
                      {agent.apiUrl}
                    </Link>
                    <CopyButton
                      value={agent.apiUrl}
                      className="h-7 w-7 shrink-0"
                    />
                  </div>
                </TableCell>
                <TableCell>
                  {agent.tags.length > 0 ? (
                    <Badge variant="secondary" className="truncate">
                      {t("table.tagCount", { count: agent.tags.length })}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {t("table.noTags")}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={getRegistrationStatusBadgeVariant(
                      agent.registrationState,
                    )}
                    className={cn(
                      agent.registrationState === "RegistrationConfirmed" &&
                        "border-green-200 bg-green-50 text-green-700 hover:bg-green-50/80 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50",
                    )}
                  >
                    {tRegistrationStatus(
                      getRegistrationStatusKey(agent.registrationState),
                    )}
                  </Badge>
                </TableCell>
                <TableCell className="text-right sticky right-0 z-10 w-48 min-w-48 bg-gradient-to-r from-transparent via-background/80 to-background pointer-events-none [&>*]:pointer-events-auto">
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

      <DeleteAgentDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setSelectedAgentToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        agentName={selectedAgentToDelete?.name ?? ""}
        isLoading={isDeleting}
      />
    </>
  );
}
