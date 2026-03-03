"use client";

import { ShieldCheck, Trash2, Unplug } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { deregisterAgentAction } from "@/lib/actions/agent.action";
import { type Agent, agentApiClient } from "@/lib/api/agent.client";
import {
  formatPricingDisplay,
  formatRelativeDate,
  shortenAddress,
  stripHtml,
} from "@/lib/utils";

import { DeleteAgentDialog } from "../[id]/components/delete-agent-dialog";
import { DeregisterAgentDialog } from "../[id]/components/deregister-agent-dialog";
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
  const tDetails = useTranslations("App.Agents.Details");
  const tRegistrationStatus = useTranslations("App.Agents.registrationStatus");

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeregisterDialogOpen, setIsDeregisterDialogOpen] = useState(false);
  const [selectedAgentToDelete, setSelectedAgentToDelete] =
    useState<Agent | null>(null);
  const [selectedAgentToDeregister, setSelectedAgentToDeregister] =
    useState<Agent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeregistering, setIsDeregistering] = useState(false);
  const [, startTransition] = useTransition();

  const handleDeleteClick = (e: React.MouseEvent, agent: Agent) => {
    e.stopPropagation();
    setSelectedAgentToDelete(agent);
    setIsDeleteDialogOpen(true);
  };

  const handleDeregisterClick = (e: React.MouseEvent, agent: Agent) => {
    e.stopPropagation();
    setSelectedAgentToDeregister(agent);
    setIsDeregisterDialogOpen(true);
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

  const handleDeregisterConfirm = () => {
    if (!selectedAgentToDeregister) return;
    setIsDeregistering(true);
    startTransition(async () => {
      const result = await deregisterAgentAction(selectedAgentToDeregister.id);
      if (result.success) {
        toast.success(tDetails("deregisterSuccess"));
        onDeleteSuccess(); // refetch list
        setIsDeregisterDialogOpen(false);
        setSelectedAgentToDeregister(null);
      } else {
        toast.error(result.error ?? tDetails("deregisterError"));
      }
      setIsDeregistering(false);
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
            {agents.map((agent) => {
              const isConfirmed =
                agent.registrationState === "RegistrationConfirmed";
              const isLegacyConfirmed = isConfirmed && !agent.agentIdentifier; // no payment-node registration
              const isDeletable =
                agent.registrationState === "DeregistrationConfirmed" ||
                agent.registrationState === "RegistrationFailed" ||
                isLegacyConfirmed;
              const isPending =
                agent.registrationState === "RegistrationRequested" ||
                agent.registrationState === "RegistrationInitiated" ||
                agent.registrationState === "DeregistrationRequested" ||
                agent.registrationState === "DeregistrationInitiated";
              return (
                <TableRow
                  key={agent.id}
                  className="cursor-pointer hover:bg-muted/50 group"
                  onClick={() => onAgentClick(agent)}
                >
                  <TableCell className="max-w-52">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium truncate">
                        {agent.name}
                      </span>
                      {agent.verificationStatus === "VERIFIED" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <ShieldCheck className="h-4 w-4 shrink-0 text-green-500" />
                          </TooltipTrigger>
                          <TooltipContent>{"Verified agent"}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {agent.description ??
                        (agent.extendedDescription
                          ? stripHtml(agent.extendedDescription)
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
                      {agent.agentIdentifier ? (
                        <>
                          <span className="truncate">
                            {shortenAddress(agent.agentIdentifier, 6)}
                          </span>
                          <CopyButton
                            value={agent.agentIdentifier}
                            className="h-7 w-7 shrink-0"
                          />
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground font-sans">
                          {t("table.noAgentId")}
                        </span>
                      )}
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
                      variant={
                        isConfirmed
                          ? "success"
                          : getRegistrationStatusBadgeVariant(
                              agent.registrationState,
                            )
                      }
                    >
                      {tRegistrationStatus(
                        getRegistrationStatusKey(agent.registrationState),
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right sticky right-0 z-10 w-48 min-w-48 bg-gradient-to-r from-transparent via-background/80 to-background pointer-events-none [&>*]:pointer-events-auto">
                    {isPending && (
                      <span className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground">
                        <Spinner size={16} />
                      </span>
                    )}
                    {isConfirmed && agent.agentIdentifier && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => handleDeregisterClick(e, agent)}
                          >
                            <Unplug className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {tDetails("deregister")}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {isDeletable && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => handleDeleteClick(e, agent)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{tDetails("delete")}</TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <DeregisterAgentDialog
        open={isDeregisterDialogOpen}
        onOpenChange={(open) => {
          setIsDeregisterDialogOpen(open);
          if (!open) setSelectedAgentToDeregister(null);
        }}
        onConfirm={handleDeregisterConfirm}
        agentName={selectedAgentToDeregister?.name ?? ""}
        isLoading={isDeregistering}
      />

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
