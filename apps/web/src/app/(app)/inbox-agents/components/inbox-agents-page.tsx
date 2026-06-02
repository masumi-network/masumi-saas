"use client";

import { ExternalLink, Inbox, Search, Trash2, Unplug } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { RefreshButton } from "@/components/ui/refresh-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFormatDate } from "@/hooks/use-format-date";
import {
  type InboxAgent,
  inboxAgentApiClient,
  type InboxAgentFilterStatus,
} from "@/lib/api/inbox-agent.client";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import { cn, shortenAddress } from "@/lib/utils";

import { InboxAgentsDiscovery } from "./inbox-agents-discovery";

const PAGE_SIZE = 10;
const MAX_VISIBLE_PAGES = 5;
const VALID_SECTIONS = ["manage", "discovery"] as const;
const DASH = "\u2014";
const MIDDLE_DOT = "\u00b7";
const METADATA_VERSION_PREFIX = "v";

type InboxTabKey = "all" | "registered" | "deregistered" | "pending" | "failed";
type InboxSection = (typeof VALID_SECTIONS)[number];

type CursorPageState<T> = {
  pages: T[][];
  nextCursors: Array<string | null>;
  currentPage: number;
  isLoading: boolean;
  isPageLoading: boolean;
  error: string | null;
};

function createCursorPageState<T>(): CursorPageState<T> {
  return {
    pages: [],
    nextCursors: [],
    currentPage: 1,
    isLoading: true,
    isPageLoading: false,
    error: null,
  };
}

function getCurrentPageItems<T>(state: CursorPageState<T>): T[] {
  return state.pages[state.currentPage - 1] ?? [];
}

function getKnownTotalPages<T>(state: CursorPageState<T>): number {
  if (state.pages.length === 0) return 1;
  return state.pages.length + (state.nextCursors.at(-1) ? 1 : 0);
}

function getPageNumbers(
  currentPage: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  const pages: Array<number | "ellipsis"> = [];

  if (totalPages <= MAX_VISIBLE_PAGES) {
    for (let page = 1; page <= totalPages; page += 1) pages.push(page);
    return pages;
  }

  if (currentPage <= 3) {
    for (let page = 1; page <= 4; page += 1) pages.push(page);
    pages.push("ellipsis");
    pages.push(totalPages);
  } else if (currentPage >= totalPages - 2) {
    pages.push(1);
    pages.push("ellipsis");
    for (let page = totalPages - 3; page <= totalPages; page += 1) {
      pages.push(page);
    }
  } else {
    pages.push(1);
    pages.push("ellipsis");
    for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
      pages.push(page);
    }
    pages.push("ellipsis");
    pages.push(totalPages);
  }

  return pages;
}

function getFilterForTab(tab: InboxTabKey): InboxAgentFilterStatus | undefined {
  switch (tab) {
    case "registered":
      return "Registered";
    case "deregistered":
      return "Deregistered";
    case "pending":
      return "Pending";
    case "failed":
      return "Failed";
    default:
      return undefined;
  }
}

function getInboxAgentStatusKey(state: InboxAgent["state"]): string {
  switch (state) {
    case "RegistrationRequested":
      return "status.pending";
    case "RegistrationInitiated":
      return "status.registering";
    case "RegistrationConfirmed":
      return "status.registered";
    case "RegistrationFailed":
      return "status.registrationFailed";
    case "DeregistrationRequested":
      return "status.pending";
    case "DeregistrationInitiated":
      return "status.deregistering";
    case "DeregistrationConfirmed":
      return "status.deregistered";
    case "DeregistrationFailed":
      return "status.deregistrationFailed";
    default:
      return state;
  }
}

function getInboxAgentBadgeVariant(state: InboxAgent["state"]) {
  if (state === "RegistrationConfirmed") return "success" as const;
  if (state === "RegistrationFailed" || state === "DeregistrationFailed") {
    return "destructive" as const;
  }
  if (state === "DeregistrationConfirmed") return "outline-muted" as const;
  return "secondary-muted" as const;
}

function CopyableValue({
  value,
  monospace = false,
}: {
  value: string;
  monospace?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "min-w-0 flex-1 break-all text-sm",
          monospace && "font-mono text-xs",
        )}
      >
        {value}
      </span>
      <CopyButton value={value} className="h-8 w-8 shrink-0" />
    </div>
  );
}

function DetailField({
  label,
  children,
  fullWidth = false,
}: {
  label: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={cn("space-y-2", fullWidth && "sm:col-span-2")}>
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-3">
        {children}
      </div>
    </div>
  );
}

function InboxAgentsSkeleton() {
  return (
    <div className="rounded-xl border border-border/80">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: 6 }).map((_, index) => (
              <TableHead key={index}>
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }).map((_, index) => (
            <TableRow key={index}>
              {Array.from({ length: 6 }).map((__, cellIndex) => (
                <TableCell key={cellIndex}>
                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function InboxAgentsPagination({
  currentPage,
  totalPages,
  isLoading,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations("App.InboxAgents");
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            text={t("pagination.previous")}
            ariaLabel={t("pagination.previousAriaLabel")}
            onClick={() => {
              if (!isLoading && currentPage > 1) {
                onPageChange(currentPage - 1);
              }
            }}
            aria-disabled={isLoading || currentPage === 1}
            className={
              isLoading || currentPage === 1
                ? "pointer-events-none opacity-50"
                : ""
            }
          />
        </PaginationItem>
        {pages.map((page, index) =>
          page === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis srText={t("pagination.morePages")} />
            </PaginationItem>
          ) : (
            <PaginationItem key={page}>
              <PaginationLink
                onClick={() => {
                  if (!isLoading) onPageChange(page);
                }}
                isActive={currentPage === page}
                disabled={isLoading}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            text={t("pagination.next")}
            ariaLabel={t("pagination.nextAriaLabel")}
            onClick={() => {
              if (!isLoading && currentPage < totalPages) {
                onPageChange(currentPage + 1);
              }
            }}
            aria-disabled={isLoading || currentPage === totalPages}
            className={
              isLoading || currentPage === totalPages
                ? "pointer-events-none opacity-50"
                : ""
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function InboxAgentDetailsDialog({
  agent,
  open,
  onOpenChange,
  onSuccess,
}: {
  agent: InboxAgent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const t = useTranslations("App.InboxAgents");
  const { network } = usePaymentNetwork();
  const { formatDate, formatRelativeDate } = useFormatDate();
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const actionKey: "delete" | "deregister" | null = useMemo(() => {
    if (!agent) return null;
    if (agent.state === "RegistrationConfirmed") return "deregister";
    if (
      agent.state === "RegistrationFailed" ||
      agent.state === "DeregistrationConfirmed"
    ) {
      return "delete";
    }
    return null;
  }, [agent]);
  const actionLabel = actionKey ? t(actionKey) : null;

  const holdingWallet =
    agent?.RecipientWallet ?? agent?.SmartContractWallet ?? null;

  const handleAction = useCallback(async () => {
    if (!agent || !actionKey) return;

    setIsActionLoading(true);
    try {
      const result =
        actionKey === "delete"
          ? await inboxAgentApiClient.deleteInboxAgent(agent.id, { network })
          : await inboxAgentApiClient.deregisterInboxAgent(agent.id, {
              network,
            });

      if (!result.success) {
        toast.error(
          result.error || t("actionFailed", { action: t(actionKey) }),
        );
        return;
      }

      toast.success(
        actionKey === "delete"
          ? t("deletedToast")
          : t("deregistrationStartedToast"),
      );
      setConfirmOpen(false);
      onOpenChange(false);
      onSuccess();
    } finally {
      setIsActionLoading(false);
    }
  }, [actionKey, agent, network, onOpenChange, onSuccess, t]);

  if (!agent) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <DialogTitle>{agent.name}</DialogTitle>
                <DialogDescription className="mt-2">
                  {t("detail.inboxSlug")}{" "}
                  <span className="font-mono">{agent.agentSlug}</span>
                </DialogDescription>
              </div>
              <Badge variant={getInboxAgentBadgeVariant(agent.state)}>
                {t(getInboxAgentStatusKey(agent.state))}
              </Badge>
            </div>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label={t("detail.description")} fullWidth>
              <p className="text-sm text-muted-foreground">
                {agent.description || t("noDescriptionProvided")}
              </p>
            </DetailField>

            <DetailField label={t("detail.agentIdentifier")}>
              {agent.agentIdentifier ? (
                <CopyableValue monospace value={agent.agentIdentifier} />
              ) : (
                <span className="text-sm text-muted-foreground">
                  {t("noIdentifier")}
                </span>
              )}
            </DetailField>

            <DetailField label={t("detail.metadataVersion")}>
              <span className="text-sm">
                {METADATA_VERSION_PREFIX}
                {agent.metadataVersion}
              </span>
            </DetailField>

            <DetailField label={t("detail.created")}>
              <span className="text-sm">
                {formatDate(agent.createdAt)} {MIDDLE_DOT}{" "}
                {formatRelativeDate(agent.createdAt)}
              </span>
            </DetailField>

            <DetailField label={t("detail.updated")}>
              <span className="text-sm">
                {formatDate(agent.updatedAt)} {MIDDLE_DOT}{" "}
                {formatRelativeDate(agent.updatedAt)}
              </span>
            </DetailField>

            <DetailField label={t("detail.lastChecked")}>
              <span className="text-sm">
                {agent.lastCheckedAt
                  ? `${formatDate(agent.lastCheckedAt)} · ${formatRelativeDate(agent.lastCheckedAt)}`
                  : t("notCheckedYet")}
              </span>
            </DetailField>

            <DetailField label={t("detail.registrationWallet")}>
              <CopyableValue
                monospace
                value={agent.SmartContractWallet.walletAddress}
              />
            </DetailField>

            <DetailField label={t("detail.fundingWallet")}>
              {holdingWallet ? (
                <CopyableValue monospace value={holdingWallet.walletAddress} />
              ) : (
                <span className="text-sm text-muted-foreground">
                  {t("usesRegistrationWallet")}
                </span>
              )}
            </DetailField>

            <DetailField label={t("detail.currentTransaction")} fullWidth>
              {agent.CurrentTransaction ? (
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline-muted">
                      {agent.CurrentTransaction.status}
                    </Badge>
                    <span className="text-muted-foreground">
                      {agent.CurrentTransaction.confirmations != null
                        ? `${agent.CurrentTransaction.confirmations} confirmations`
                        : t("awaitingConfirmation")}
                    </span>
                  </div>
                  {agent.CurrentTransaction.txHash ? (
                    <CopyableValue
                      monospace
                      value={agent.CurrentTransaction.txHash}
                    />
                  ) : (
                    <span className="text-muted-foreground">
                      {t("noTransactionHash")}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {t("noActiveTransaction")}
                </span>
              )}
            </DetailField>

            {agent.error ? (
              <DetailField label={t("detail.failure")} fullWidth>
                <p className="text-sm text-destructive">{agent.error}</p>
              </DetailField>
            ) : null}
          </div>

          <DialogFooter className="justify-between gap-2 sm:justify-between">
            <div className="flex items-center gap-2">
              {agent.agentIdentifier ? (
                <Button
                  variant="outline"
                  asChild
                  className="inline-flex items-center gap-2"
                >
                  <Link
                    href={`/pay/api/v1/registry-inbox/agent-identifier?agentIdentifier=${encodeURIComponent(agent.agentIdentifier)}&network=${network}`}
                    target="_blank"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t("rawLookup")}
                  </Link>
                </Button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {actionLabel ? (
                <Button
                  variant={actionKey === "delete" ? "destructive" : "outline"}
                  onClick={() => setConfirmOpen(true)}
                >
                  {actionKey === "delete" ? (
                    <Trash2 className="mr-2 h-4 w-4" />
                  ) : (
                    <Unplug className="mr-2 h-4 w-4" />
                  )}
                  {actionLabel}
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("close")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => {
          void handleAction();
        }}
        title={
          actionKey === "delete"
            ? t("deleteInboxAgent")
            : t("deregisterInboxAgent")
        }
        description={
          actionKey === "delete"
            ? t("deleteInboxAgentDescription", { name: agent.name })
            : t("deregisterInboxAgentDescription", { name: agent.name })
        }
        confirmText={actionLabel ?? t("confirm")}
        variant={actionKey === "delete" ? "destructive" : "default"}
        isLoading={isActionLoading}
      />
    </>
  );
}

export function InboxAgentsPage() {
  const t = useTranslations("App.InboxAgents");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { network } = usePaymentNetwork();
  const { formatRelativeDate } = useFormatDate();
  const sectionParam = searchParams.get("section");
  const activeSection = VALID_SECTIONS.includes(sectionParam as InboxSection)
    ? (sectionParam as InboxSection)
    : "manage";
  const [activeTab, setActiveTab] = useState<InboxTabKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const [selectedAgent, setSelectedAgent] = useState<InboxAgent | null>(null);
  const [state, setState] = useState<CursorPageState<InboxAgent>>(
    createCursorPageState(),
  );

  const fetchPage = useCallback(
    async (cursorId?: string) =>
      inboxAgentApiClient.getInboxAgents(
        {
          filterStatus: getFilterForTab(activeTab),
          search: debouncedSearch || undefined,
        },
        {
          cursorId,
          take: PAGE_SIZE,
          network,
        },
      ),
    [activeTab, debouncedSearch, network],
  );

  const loadFirstPage = useCallback(async () => {
    setState((current) => ({
      ...current,
      isLoading: true,
      error: null,
      currentPage: 1,
    }));

    const result = await fetchPage();
    if (!result.success) {
      setState({
        ...createCursorPageState(),
        isLoading: false,
        error: result.error,
      });
      return;
    }

    setState({
      pages: [result.data],
      nextCursors: [result.nextCursor],
      currentPage: 1,
      isLoading: false,
      isPageLoading: false,
      error: null,
    });
  }, [fetchPage]);

  useEffect(() => {
    if (activeSection !== "manage") return;

    const timeoutId = window.setTimeout(() => {
      void loadFirstPage();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeSection, loadFirstPage]);

  const handlePageChange = useCallback(
    async (page: number) => {
      const totalPages = getKnownTotalPages(state);
      if (page < 1 || page > totalPages) return;

      if (page <= state.pages.length) {
        setState((current) => ({ ...current, currentPage: page }));
        return;
      }

      const cursor = state.nextCursors[state.pages.length - 1];
      if (!cursor) return;

      setState((current) => ({ ...current, isPageLoading: true, error: null }));
      const result = await fetchPage(cursor);
      if (!result.success) {
        setState((current) => ({
          ...current,
          isPageLoading: false,
          error: result.error,
        }));
        return;
      }

      setState((current) => ({
        pages: [...current.pages, result.data],
        nextCursors: [...current.nextCursors, result.nextCursor],
        currentPage: page,
        isLoading: false,
        isPageLoading: false,
        error: null,
      }));
    },
    [fetchPage, state],
  );

  const tabs = [
    { name: t("tabs.all"), key: "all" },
    { name: t("tabs.registered"), key: "registered" },
    { name: t("tabs.deregistered"), key: "deregistered" },
    { name: t("tabs.pending"), key: "pending" },
    { name: t("tabs.failed"), key: "failed" },
  ];
  const sections = [
    { name: t("sections.manage"), key: "manage" },
    { name: t("sections.discovery"), key: "discovery" },
  ];

  const handleSectionChange = (section: InboxSection) => {
    const params = new URLSearchParams(searchParams.toString());
    if (section === "manage") {
      params.delete("section");
    } else {
      params.set("section", section);
    }
    const query = params.toString();
    router.push(query ? `/inbox-agents?${query}` : "/inbox-agents");
  };

  const currentItems = getCurrentPageItems(state);
  const totalPages = getKnownTotalPages(state);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={
          activeSection === "manage"
            ? t("manageDescription", { network: network })
            : t("discoveryDescription", { network: network })
        }
        actions={
          activeSection === "manage" ? (
            <RefreshButton
              onRefresh={() => void loadFirstPage()}
              isRefreshing={state.isLoading || state.isPageLoading}
            />
          ) : undefined
        }
      />

      <div className="space-y-4">
        <Tabs
          tabs={sections}
          activeTab={activeSection}
          onTabChange={(section) =>
            handleSectionChange(section as InboxSection)
          }
        />

        {activeSection === "manage" ? (
          <div className="space-y-4 rounded-2xl border border-border/80 bg-background/95 p-4 sm:p-6">
            <Tabs
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={(tab) => setActiveTab(tab as InboxTabKey)}
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="pl-10"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                {state.isPageLoading
                  ? t("loadingPage")
                  : t("page", { page: state.currentPage })}
              </div>
            </div>

            {state.isLoading ? (
              <InboxAgentsSkeleton />
            ) : state.error ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-5 text-sm text-destructive">
                {state.error}
              </div>
            ) : currentItems.length === 0 ? (
              <div className="rounded-xl border border-dashed px-6 py-14 text-center">
                <div className="mx-auto max-w-md space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Inbox className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-base font-medium">{t("emptyTitle")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("emptyDescription")}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-border/80">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>{t("table.name")}</TableHead>
                        <TableHead>{t("table.added")}</TableHead>
                        <TableHead>{t("table.inboxSlug")}</TableHead>
                        <TableHead>{t("table.agentId")}</TableHead>
                        <TableHead>{t("table.wallets")}</TableHead>
                        <TableHead>{t("table.status")}</TableHead>
                        <TableHead className="text-right">
                          {t("table.actions")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentItems.map((agent, index) => {
                        const holdingWallet =
                          agent.RecipientWallet ?? agent.SmartContractWallet;

                        return (
                          <TableRow
                            key={agent.id}
                            className="cursor-pointer hover:bg-muted/50 animate-table-row-in"
                            style={{ animationDelay: `${index * 40}ms` }}
                            onClick={() => setSelectedAgent(agent)}
                          >
                            <TableCell className="max-w-56">
                              <div className="space-y-1">
                                <div className="font-medium">{agent.name}</div>
                                <div className="truncate text-xs text-muted-foreground">
                                  {agent.description || t("noDescription")}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatRelativeDate(agent.createdAt)}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {agent.agentSlug}
                            </TableCell>
                            <TableCell className="max-w-44">
                              {agent.agentIdentifier ? (
                                <div
                                  className="flex items-center gap-2"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <span className="truncate font-mono text-xs">
                                    {shortenAddress(agent.agentIdentifier, 8)}
                                  </span>
                                  <CopyButton
                                    value={agent.agentIdentifier}
                                    className="h-8 w-8 shrink-0"
                                  />
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  {DASH}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              <div>
                                {t("regWalletPrefix")}{" "}
                                {shortenAddress(
                                  agent.SmartContractWallet.walletAddress,
                                  8,
                                )}
                              </div>
                              <div>
                                {t("fundWalletPrefix")}{" "}
                                {shortenAddress(holdingWallet.walletAddress, 8)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={getInboxAgentBadgeVariant(agent.state)}
                              >
                                {t(getInboxAgentStatusKey(agent.state))}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedAgent(agent);
                                }}
                              >
                                {t("details")}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <InboxAgentsPagination
                  currentPage={state.currentPage}
                  totalPages={totalPages}
                  isLoading={state.isPageLoading}
                  onPageChange={(page) => {
                    void handlePageChange(page);
                  }}
                />
              </>
            )}
          </div>
        ) : (
          <InboxAgentsDiscovery />
        )}
      </div>

      <InboxAgentDetailsDialog
        agent={selectedAgent}
        open={selectedAgent != null}
        onOpenChange={(open) => {
          if (!open) setSelectedAgent(null);
        }}
        onSuccess={() => {
          setSelectedAgent(null);
          void loadFirstPage();
        }}
      />
    </div>
  );
}
