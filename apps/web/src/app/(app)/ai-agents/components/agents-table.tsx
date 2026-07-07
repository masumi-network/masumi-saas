"use client";

import { Trash2, Unplug } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AgentVerificationShieldIndicator } from "@/components/agent-verification-shield-indicator";
import { CompactAgentPricing } from "@/components/compact-agent-pricing";
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
import { useFormatDate } from "@/hooks/use-format-date";
import {
  canDeregisterAgent,
  isAgentLiveOnRegistry,
  isRegistrationConfirmedOnNetwork,
  isRegistrationUiPending,
} from "@/lib/agents/registration-state";
import { type Agent, agentApiClient } from "@/lib/api/agent.client";
import { useX402Networks } from "@/lib/hooks/use-x402";
import { shortenAddress, stripHtml } from "@/lib/utils";

import { DeleteAgentDialog } from "../[id]/components/delete-agent-dialog";
import { DeregisterAgentDialog } from "../[id]/components/deregister-agent-dialog";
import {
  getRegistrationStatusBadgeClassName,
  getRegistrationStatusBadgeVariant,
  getRegistrationStatusDisplayKey,
} from "./agent-utils";
import {
  agentsTableShowsX402Column,
  AgentX402TableCell,
} from "./agent-x402-options";

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
  const { formatRelativeDate } = useFormatDate();
  const { networks: x402Networks } = useX402Networks({
    silentErrors: true,
    allEnvironments: true,
  });
  const showX402Column = useMemo(
    () => agentsTableShowsX402Column(agents),
    [agents],
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeregisterDialogOpen, setIsDeregisterDialogOpen] = useState(false);
  const [selectedAgentToDelete, setSelectedAgentToDelete] =
    useState<Agent | null>(null);
  const [selectedAgentToDeregister, setSelectedAgentToDeregister] =
    useState<Agent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeregistering, setIsDeregistering] = useState(false);

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
    (async () => {
      try {
        const result = await agentApiClient.deleteAgent(
          selectedAgentToDelete.id,
        );
        if (result.success) {
          toast.success(t("deleteSuccess"));
          onDeleteSuccess();
          setIsDeleteDialogOpen(false);
          setSelectedAgentToDelete(null);
        } else {
          toast.error(result.error || t("deleteError"));
        }
      } finally {
        setIsDeleting(false);
      }
    })().catch(() => {
      // finally already cleared loading; catch only prevents unhandled rejection.
    });
  };

  const handleDeregisterConfirm = () => {
    if (!selectedAgentToDeregister) return;
    setIsDeregistering(true);
    (async () => {
      try {
        const result = await agentApiClient.deregisterAgent(
          selectedAgentToDeregister.id,
        );
        if (result.success) {
          toast.success(tDetails("deregisterSuccess"));
          onDeleteSuccess(); // refetch list
          setIsDeregisterDialogOpen(false);
          setSelectedAgentToDeregister(null);
        } else {
          toast.error(result.error ?? tDetails("deregisterError"));
        }
      } finally {
        setIsDeregistering(false);
      }
    })().catch(() => {
      // finally already cleared loading; catch only prevents unhandled rejection.
    });
  };

  if (agents.length === 0) {
    return null;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t("table.name")}</TableHead>
              <TableHead>{t("table.added")}</TableHead>
              <TableHead>{t("table.agentId")}</TableHead>
              <TableHead>{t("table.apiUrl")}</TableHead>
              <TableHead>{t("table.price")}</TableHead>
              <TableHead>{t("table.payoutAddress")}</TableHead>
              {showX402Column ? <TableHead>{t("table.x402")}</TableHead> : null}
              <TableHead>{t("table.tags")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead className="text-right sticky right-0 z-10 w-48 min-w-48 bg-gradient-to-r from-transparent via-background/80 to-background">
                {t("table.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent, index) => {
              const isRegistrationSettled = isRegistrationConfirmedOnNetwork(
                agent.registrationState,
              );
              const isLegacyConfirmed =
                isRegistrationSettled && !agent.agentIdentifier; // no payment-node registration
              const isDeletable =
                agent.registrationState === "DeregistrationConfirmed" ||
                agent.registrationState === "RegistrationFailed" ||
                agent.registrationState === "DeregistrationFailed" ||
                isLegacyConfirmed;
              const isPending = isRegistrationUiPending(
                agent.registrationState,
              );
              const showActionsSpinner = isPending;
              return (
                <TableRow
                  key={agent.id}
                  className="cursor-pointer hover:bg-muted/50 group animate-table-row-in transition-[background-color,opacity] duration-150"
                  style={{
                    animationDelay: `${Math.min(index, 9) * 40}ms`,
                  }}
                  onClick={() => onAgentClick(agent)}
                >
                  <TableCell className="max-w-52">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-medium">
                        {agent.name}
                      </span>
                      {agent.verificationStatus === "VERIFIED" ? (
                        <span
                          className="inline-flex shrink-0"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.stopPropagation();
                            }
                          }}
                        >
                          <AgentVerificationShieldIndicator
                            agentId={agent.id}
                            dbVerificationStatus={agent.verificationStatus}
                            registered={isAgentLiveOnRegistry(
                              agent.registrationState,
                            )}
                            className="-mt-px"
                          />
                        </span>
                      ) : null}
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
                          <span
                            className="truncate"
                            title={agent.agentIdentifier}
                          >
                            {agent.agentIdentifier}
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
                  <TableCell className="text-sm">
                    <CompactAgentPricing pricing={agent.pricing} />
                  </TableCell>
                  <TableCell>
                    <div
                      className="text-xs font-mono truncate max-w-44 flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {agent.payoutAddress ? (
                        <>
                          <span
                            className="truncate"
                            title={agent.payoutAddress}
                          >
                            {shortenAddress(agent.payoutAddress, 8)}
                          </span>
                          <CopyButton
                            value={agent.payoutAddress}
                            className="h-7 w-7 shrink-0"
                          />
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground font-sans">
                          {t("table.noPayoutAddress")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  {showX402Column ? (
                    <TableCell>
                      <AgentX402TableCell
                        sources={agent.supportedPaymentSources}
                        pricing={agent.pricing}
                        networks={x402Networks}
                        emptyLabel={t("table.noX402")}
                      />
                    </TableCell>
                  ) : null}
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
                        isRegistrationSettled
                          ? "success"
                          : getRegistrationStatusBadgeVariant(
                              agent.registrationState,
                            )
                      }
                      className={getRegistrationStatusBadgeClassName(
                        agent.registrationState,
                      )}
                    >
                      {tRegistrationStatus(
                        getRegistrationStatusDisplayKey(
                          agent.registrationState,
                        ),
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right sticky right-0 z-10 w-48 min-w-48 bg-gradient-to-r from-transparent via-background/80 to-background pointer-events-none [&>*]:pointer-events-auto">
                    {showActionsSpinner && (
                      <span className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground">
                        <Spinner size={16} />
                      </span>
                    )}
                    {canDeregisterAgent(agent.registrationState) &&
                      agent.agentIdentifier && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={tDetails("deregister")}
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
                            aria-label={tDetails("delete")}
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
