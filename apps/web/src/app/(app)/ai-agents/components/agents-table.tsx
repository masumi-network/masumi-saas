"use client";

import { getEvmFixedPrice } from "@masumi/payment-source-x402/payment-source";
import { Trash2, Unplug } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AgentVerificationShieldIndicator } from "@/components/agent-verification-shield-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyButton } from "@/components/ui/copy-button";
import { HorizontalScrollArea } from "@/components/ui/horizontal-scroll-area";
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
import { useChainRegistryIcons } from "@/hooks/use-chain-registry-icons";
import { useFormatDate } from "@/hooks/use-format-date";
import {
  isAgentBulkActionSelectable,
  isAgentDeletable,
  isAgentDeregisterable,
  isAgentLiveOnRegistry,
  isRegistrationConfirmedOnNetwork,
  isRegistrationUiPending,
} from "@/lib/agents/registration-state";
import { type Agent, agentApiClient } from "@/lib/api/agent.client";
import { usePaymentNodeSupportedX402Networks } from "@/lib/hooks/use-x402-networks";
import { cn, shortenAddress } from "@/lib/utils";

import { DeleteAgentDialog } from "../[id]/components/delete-agent-dialog";
import { DeregisterAgentDialog } from "../[id]/components/deregister-agent-dialog";
import { AgentRegistryVersionBadge } from "./agent-registry-version-badge";
import {
  getRegistrationStatusBadgeClassName,
  getRegistrationStatusBadgeVariant,
  getRegistrationStatusDisplayKey,
} from "./agent-utils";
import {
  AgentPayoutTableCell,
  AgentPriceTableCell,
  agentsTableShowsX402Column,
  AgentX402TableCell,
} from "./agent-x402-options";
import { BatchDeleteAgentsDialog } from "./batch-delete-agents-dialog";
import { BatchDeregisterAgentsDialog } from "./batch-deregister-agents-dialog";

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
  const { networks: x402Networks } = usePaymentNodeSupportedX402Networks({
    silentErrors: true,
    allEnvironments: true,
  });
  const showX402Column = useMemo(
    () => agentsTableShowsX402Column(agents),
    [agents],
  );
  const payoutChainCaip2Ids = useMemo(
    () => [
      ...new Set(
        agents.flatMap((agent) =>
          (agent.supportedPaymentSources ?? [])
            .filter(
              (source) =>
                source.chain === "EVM" && getEvmFixedPrice(source) != null,
            )
            .map((source) => source.network),
        ),
      ),
    ],
    [agents],
  );
  const payoutChainIconSlugs = useChainRegistryIcons(payoutChainCaip2Ids);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeregisterDialogOpen, setIsDeregisterDialogOpen] = useState(false);
  const [selectedAgentToDelete, setSelectedAgentToDelete] =
    useState<Agent | null>(null);
  const [selectedAgentToDeregister, setSelectedAgentToDeregister] =
    useState<Agent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeregistering, setIsDeregistering] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isBatchDeregisterOpen, setIsBatchDeregisterOpen] = useState(false);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  const [isBatchDeregistering, setIsBatchDeregistering] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  useEffect(() => {
    setSelectedIds((prev) => {
      const visible = new Set(agents.map((agent) => agent.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [agents]);

  const selectableAgents = useMemo(
    () =>
      agents.filter((agent) =>
        isAgentBulkActionSelectable({
          registrationState: agent.registrationState,
          agentIdentifier: agent.agentIdentifier,
        }),
      ),
    [agents],
  );

  const selectedAgents = useMemo(
    () => agents.filter((agent) => selectedIds.has(agent.id)),
    [agents, selectedIds],
  );

  const selectedDeregisterAgents = useMemo(
    () =>
      selectedAgents.filter((agent) =>
        isAgentDeregisterable({
          registrationState: agent.registrationState,
          agentIdentifier: agent.agentIdentifier,
        }),
      ),
    [selectedAgents],
  );

  const selectedDeleteAgents = useMemo(
    () =>
      selectedAgents.filter((agent) =>
        isAgentDeletable({
          registrationState: agent.registrationState,
          agentIdentifier: agent.agentIdentifier,
        }),
      ),
    [selectedAgents],
  );

  const allSelectableSelected =
    selectableAgents.length > 0 &&
    selectableAgents.every((agent) => selectedIds.has(agent.id));
  const someSelectableSelected = selectableAgents.some((agent) =>
    selectedIds.has(agent.id),
  );

  const toggleAgentSelected = (agentId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(agentId);
      else next.delete(agentId);
      return next;
    });
  };

  const toggleSelectAll = (selected: boolean) => {
    if (!selected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(selectableAgents.map((agent) => agent.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

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

  const handleBatchDeregisterConfirm = () => {
    if (selectedDeregisterAgents.length === 0) return;
    setIsBatchDeregistering(true);
    (async () => {
      let succeeded = 0;
      let failed = 0;
      try {
        for (const agent of selectedDeregisterAgents) {
          const result = await agentApiClient.deregisterAgent(agent.id);
          if (result.success) {
            succeeded += 1;
          } else {
            failed += 1;
          }
        }
        if (succeeded > 0) {
          toast.success(t("batchDeregisterSuccess", { count: succeeded }));
          onDeleteSuccess();
        }
        if (failed > 0) {
          toast.error(t("batchActionPartialFailed", { count: failed }));
        }
        setIsBatchDeregisterOpen(false);
        clearSelection();
      } finally {
        setIsBatchDeregistering(false);
      }
    })().catch(() => {});
  };

  const handleBatchDeleteConfirm = () => {
    if (selectedDeleteAgents.length === 0) return;
    setIsBatchDeleting(true);
    (async () => {
      let succeeded = 0;
      let failed = 0;
      try {
        for (const agent of selectedDeleteAgents) {
          const result = await agentApiClient.deleteAgent(agent.id);
          if (result.success) succeeded += 1;
          else failed += 1;
        }
        if (succeeded > 0) {
          toast.success(t("batchDeleteSuccess", { count: succeeded }));
          onDeleteSuccess();
        }
        if (failed > 0) {
          toast.error(t("batchActionPartialFailed", { count: failed }));
        }
        setIsBatchDeleteOpen(false);
        clearSelection();
      } finally {
        setIsBatchDeleting(false);
      }
    })().catch(() => {});
  };

  if (agents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-muted/30 px-4 py-2.5 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 fill-mode-both motion-reduce:animate-none">
          <p className="text-sm text-muted-foreground">
            {t("batchSelected", { count: selectedIds.size })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                selectedDeregisterAgents.length === 0 || isBatchDeregistering
              }
              onClick={() => setIsBatchDeregisterOpen(true)}
            >
              <Unplug className="mr-1.5 size-3.5" aria-hidden />
              {t("batchDeregisterAction", {
                count: selectedDeregisterAgents.length,
              })}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={selectedDeleteAgents.length === 0 || isBatchDeleting}
              onClick={() => setIsBatchDeleteOpen(true)}
            >
              <Trash2 className="mr-1.5 size-3.5" aria-hidden />
              {t("batchDeleteAction", { count: selectedDeleteAgents.length })}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSelection}
            >
              {t("batchClearSelection")}
            </Button>
          </div>
        </div>
      ) : null}
      <HorizontalScrollArea className="rounded-xl border border-border/80">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 p-0">
                <div className="flex h-12 items-center pl-4">
                  <Checkbox
                    checked={
                      allSelectableSelected
                        ? true
                        : someSelectableSelected
                          ? "indeterminate"
                          : false
                    }
                    disabled={selectableAgents.length === 0}
                    aria-label={t("table.selectAll")}
                    onCheckedChange={(checked) =>
                      toggleSelectAll(checked === true)
                    }
                  />
                </div>
              </TableHead>
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
              const isDeletable = isAgentDeletable({
                registrationState: agent.registrationState,
                agentIdentifier: agent.agentIdentifier,
              });
              const isDeregisterable = isAgentDeregisterable({
                registrationState: agent.registrationState,
                agentIdentifier: agent.agentIdentifier,
              });
              const isSelectable = isAgentBulkActionSelectable({
                registrationState: agent.registrationState,
                agentIdentifier: agent.agentIdentifier,
              });
              const isPending = isRegistrationUiPending(
                agent.registrationState,
              );
              const showActionsSpinner = isPending;
              const isSelected = selectedIds.has(agent.id);
              return (
                <TableRow
                  key={agent.id}
                  className={cn(
                    "cursor-pointer hover:bg-muted/50 group animate-table-row-in transition-[background-color,opacity] duration-150",
                    isSelected && "bg-primary/5 hover:bg-primary/10",
                  )}
                  style={{
                    animationDelay: `${Math.min(index, 9) * 40}ms`,
                  }}
                  onClick={() => onAgentClick(agent)}
                >
                  <TableCell
                    className="w-10 pr-0"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={!isSelectable || isPending}
                      aria-label={t("table.selectRow", { name: agent.name })}
                      onCheckedChange={(checked) =>
                        toggleAgentSelected(agent.id, checked === true)
                      }
                    />
                  </TableCell>
                  <TableCell className="max-w-52">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-medium">
                        {agent.name}
                      </span>
                      <AgentRegistryVersionBadge
                        agentIdentifier={agent.agentIdentifier}
                        className="-mt-px"
                      />
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
                      {agent.description}
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
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default truncate font-mono">
                                {shortenAddress(agent.agentIdentifier, 7)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-md text-tooltip-foreground"
                            >
                              <p className="break-all font-mono text-xs leading-relaxed">
                                {agent.agentIdentifier}
                              </p>
                            </TooltipContent>
                          </Tooltip>
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            href={agent.apiUrl}
                            target="_blank"
                            className="min-w-0 truncate hover:underline text-muted-foreground"
                          >
                            {agent.apiUrl}
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-md text-tooltip-foreground"
                        >
                          <p className="break-all font-mono text-xs leading-relaxed">
                            {agent.apiUrl}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                      <CopyButton
                        value={agent.apiUrl}
                        className="h-7 w-7 shrink-0"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <AgentPriceTableCell
                      pricing={agent.pricing}
                      supportedPaymentSources={agent.supportedPaymentSources}
                      networks={x402Networks}
                    />
                  </TableCell>
                  <TableCell>
                    <AgentPayoutTableCell
                      payoutAddress={agent.payoutAddress}
                      supportedPaymentSources={agent.supportedPaymentSources}
                      networks={x402Networks}
                      chainIconSlugs={payoutChainIconSlugs}
                      cardanoEmptyLabel={t("table.noPayoutAddress")}
                      x402PayToTitle={t("table.x402PayToHint")}
                    />
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
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {agent.tags.length > 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="secondary"
                            className="max-w-full cursor-default truncate"
                          >
                            {t("table.tagCount", { count: agent.tags.length })}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-xs text-tooltip-foreground"
                        >
                          <p className="text-sm leading-snug">
                            {agent.tags.join(", ")}
                          </p>
                        </TooltipContent>
                      </Tooltip>
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
                    {isDeregisterable && (
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
      </HorizontalScrollArea>

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

      <BatchDeregisterAgentsDialog
        open={isBatchDeregisterOpen}
        onOpenChange={setIsBatchDeregisterOpen}
        count={selectedDeregisterAgents.length}
        onConfirm={handleBatchDeregisterConfirm}
        isLoading={isBatchDeregistering}
      />

      <BatchDeleteAgentsDialog
        open={isBatchDeleteOpen}
        onOpenChange={setIsBatchDeleteOpen}
        count={selectedDeleteAgents.length}
        onConfirm={handleBatchDeleteConfirm}
        isLoading={isBatchDeleting}
      />
    </div>
  );
}
