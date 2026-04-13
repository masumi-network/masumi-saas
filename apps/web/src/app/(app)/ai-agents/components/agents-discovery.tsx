"use client";

import { Activity, ChevronRight, ExternalLink, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Spinner } from "@/components/ui/spinner";
import { Tabs } from "@/components/ui/tabs";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  type InboxAgentRegistration,
  registryDiscoveryClient,
  type RegistryEntry,
} from "@/lib/api/registry-discovery.client";
import { usePaymentNetwork } from "@/lib/context/payment-network-context";
import { formatUnitAmount } from "@/lib/payment-node/format";
import { formatRelativeDate, getInitials, shortenAddress } from "@/lib/utils";

const PAGE_SIZE = 12;
const DISCOVERY_TABS = ["agents", "inbox"] as const;
const MAX_VISIBLE_PAGES = 5;

type DiscoveryTab = (typeof DISCOVERY_TABS)[number];

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
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }

  if (currentPage <= 3) {
    for (let i = 1; i <= 4; i++) pages.push(i);
    pages.push("ellipsis");
    pages.push(totalPages);
  } else if (currentPage >= totalPages - 2) {
    pages.push(1);
    pages.push("ellipsis");
    for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    pages.push("ellipsis");
    for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
    pages.push("ellipsis");
    pages.push(totalPages);
  }

  return pages;
}

function formatPricing(
  entry: RegistryEntry,
  free: string,
  dynamic: string,
  unavailable: string,
) {
  const pricing = entry.AgentPricing;

  if (pricing.pricingType === "Free") return free;
  if (pricing.pricingType === "Dynamic") return dynamic;
  if ("FixedPricing" in pricing && pricing.FixedPricing.Amounts.length > 0) {
    return pricing.FixedPricing.Amounts.map((amount) =>
      formatUnitAmount(amount.unit, amount.amount),
    ).join(", ");
  }

  return unavailable;
}

function formatPublisher(entry: RegistryEntry, fallback: string) {
  const parts = [entry.authorName, entry.authorOrganization].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : fallback;
}

function matchesRegistryLookup(entry: RegistryEntry, query: string) {
  if (!query) return true;

  const haystack = [
    entry.name,
    entry.description ?? "",
    entry.agentIdentifier,
    entry.apiBaseUrl,
    entry.authorName ?? "",
    entry.authorOrganization ?? "",
    entry.Capability?.name ?? "",
    entry.Capability?.version ?? "",
    ...(entry.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function matchesInboxLookup(
  registration: InboxAgentRegistration,
  query: string,
) {
  if (!query) return true;

  const haystack = [
    registration.name,
    registration.description ?? "",
    registration.agentIdentifier,
    registration.agentSlug,
    registration.RegistrySource.policyId ?? "",
    registration.RegistrySource.url ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function getInboxRegistrationBadgeVariant(
  status: InboxAgentRegistration["status"],
) {
  switch (status) {
    case "Verified":
      return "success" as const;
    case "Pending":
      return "secondary-muted" as const;
    case "Invalid":
      return "destructive" as const;
    case "Deregistered":
      return "outline-muted" as const;
    default:
      return "secondary" as const;
  }
}

function DiscoverySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card
          key={index}
          className="rounded-xl border-border/80 py-0 shadow-sm"
        >
          <CardContent className="px-4 py-4 sm:px-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                </div>
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                <div className="flex flex-wrap gap-2">
                  <div className="h-5 w-28 animate-pulse rounded-full bg-muted" />
                  <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DiscoveryPaginationBar({
  currentPage,
  totalPages,
  isLoading,
  onPageChange,
  labels,
}: {
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  labels: {
    previous: string;
    next: string;
    previousAriaLabel: string;
    nextAriaLabel: string;
    ellipsisSrText: string;
  };
}) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            text={labels.previous}
            ariaLabel={labels.previousAriaLabel}
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
              <PaginationEllipsis srText={labels.ellipsisSrText} />
            </PaginationItem>
          ) : (
            <PaginationItem key={page}>
              <PaginationLink
                onClick={() => {
                  if (!isLoading) {
                    onPageChange(page);
                  }
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
            text={labels.next}
            ariaLabel={labels.nextAriaLabel}
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

function DiscoveryDetailItem({
  label,
  children,
  fullWidth = false,
}: {
  label: string;
  children: ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "space-y-2 sm:col-span-2" : "space-y-2"}>
      <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="rounded-lg border border-border/70 bg-muted-surface/60 px-3 py-3 text-sm">
        {children}
      </div>
    </div>
  );
}

function RegistryEntryDetailsDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: RegistryEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("App.Agents");

  if (!entry) return null;

  const tags = entry.tags ?? [];
  const capabilityLabel = entry.Capability?.name
    ? entry.Capability.version
      ? `${entry.Capability.name} v${entry.Capability.version}`
      : entry.Capability.name
    : t("Discovery.noCapability");
  const pricingLabel = formatPricing(
    entry,
    t("Discovery.pricing.free"),
    t("Discovery.pricing.dynamic"),
    t("Discovery.pricing.unavailable"),
  );
  const publisher = formatPublisher(entry, t("Discovery.authorFallback"));
  const paymentLabel =
    entry.paymentType === "Web3CardanoV1"
      ? t("Discovery.payment.cardano")
      : t("Discovery.payment.none");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,760px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[760px]">
        <DialogHeader className="shrink-0 border-b px-6 py-5">
          <div className="flex items-start gap-4 pr-8">
            <Avatar className="h-14 w-14 border border-border/70">
              <AvatarImage src={entry.image ?? undefined} alt={entry.name} />
              <AvatarFallback>{getInitials(entry.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-xl">{entry.name}</DialogTitle>
                <Badge variant="success">{entry.status}</Badge>
              </div>
              <DialogDescription className="leading-6">
                {entry.description?.trim() || t("Details.noDescription")}
              </DialogDescription>
              <div className="flex flex-wrap gap-2">
                <Badge variant="primary-muted">{capabilityLabel}</Badge>
                <Badge variant="secondary">{paymentLabel}</Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <DiscoveryDetailItem label={t("table.apiUrl")} fullWidth>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={entry.apiBaseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-foreground hover:underline"
                >
                  {entry.apiBaseUrl}
                </Link>
                <CopyButton value={entry.apiBaseUrl} />
                <Button asChild variant="outline" size="sm2">
                  <Link
                    href={entry.apiBaseUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("Discovery.openEndpoint")}
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("table.agentId")}>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono">
                  {entry.agentIdentifier}
                </span>
                <CopyButton value={entry.agentIdentifier} />
              </div>
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("Discovery.publisher")}>
              {publisher}
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("Discovery.updated")}>
              {formatRelativeDate(entry.updatedAt)}
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("Discovery.health")}>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                {t("Discovery.healthValue", {
                  uptimeCount: entry.uptimeCount,
                  uptimeCheckCount: entry.uptimeCheckCount,
                })}
              </div>
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("Discovery.capability")}>
              {capabilityLabel}
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("Discovery.paymentType")}>
              {paymentLabel}
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("table.price")}>
              {pricingLabel}
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("table.tags")} fullWidth>
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="outline-muted">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">
                  {t("Discovery.noTags")}
                </span>
              )}
            </DiscoveryDetailItem>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RegistryAgentListItem({
  entry,
  onViewDetails,
}: {
  entry: RegistryEntry;
  onViewDetails: () => void;
}) {
  const t = useTranslations("App.Agents");
  const tags = entry.tags ?? [];
  const capabilityLabel = entry.Capability?.name
    ? entry.Capability.version
      ? `${entry.Capability.name} v${entry.Capability.version}`
      : entry.Capability.name
    : t("Discovery.noCapability");
  const pricingLabel = formatPricing(
    entry,
    t("Discovery.pricing.free"),
    t("Discovery.pricing.dynamic"),
    t("Discovery.pricing.unavailable"),
  );
  const publisher = formatPublisher(entry, t("Discovery.authorFallback"));
  const shortDescription =
    entry.description?.trim() || t("Details.noDescription");

  return (
    <button
      type="button"
      onClick={onViewDetails}
      className="w-full rounded-xl border border-border/80 bg-card text-left shadow-sm transition-colors hover:border-primary/35 hover:bg-muted-surface/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
        <Avatar className="mt-0.5 h-10 w-10 border border-border/70">
          <AvatarImage src={entry.image ?? undefined} alt={entry.name} />
          <AvatarFallback>{getInitials(entry.name)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-base">
              {entry.name}
            </span>
            <Badge variant="success">{entry.status}</Badge>
          </div>

          <p className="line-clamp-1 text-sm text-muted-foreground">
            {shortDescription}
          </p>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{publisher}</span>
            <span className="text-border">{"\u2022"}</span>
            <span>{formatRelativeDate(entry.updatedAt)}</span>
            <span className="text-border">{"\u2022"}</span>
            <span className="flex items-center gap-1">
              <span className="font-medium text-foreground">
                {t("table.price")}
              </span>
              <span>{pricingLabel}</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="primary-muted">{capabilityLabel}</Badge>
            {tags.length > 0 && (
              <Badge variant="outline-muted">
                {tags.length === 1
                  ? tags[0]
                  : `+${tags.length} ${t("Discovery.tagsLabel")}`}
              </Badge>
            )}
          </div>
        </div>

        <div className="hidden items-center gap-2 self-center text-xs text-muted-foreground sm:flex">
          <span>{t("Discovery.viewDetails")}</span>
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </button>
  );
}

function InboxAgentDetailsDialog({
  registration,
  open,
  onOpenChange,
}: {
  registration: InboxAgentRegistration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("App.Agents");

  if (!registration) return null;

  const sourceUrl = registration.RegistrySource.url;
  const policyId = registration.RegistrySource.policyId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[720px]">
        <DialogHeader className="shrink-0 border-b px-6 py-5">
          <div className="flex items-start gap-4 pr-8">
            <Avatar className="h-14 w-14 border border-border/70">
              <AvatarFallback>{getInitials(registration.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-xl">
                  {registration.name}
                </DialogTitle>
                <Badge
                  variant={getInboxRegistrationBadgeVariant(
                    registration.status,
                  )}
                >
                  {registration.status}
                </Badge>
              </div>
              <DialogDescription className="leading-6">
                {registration.description?.trim() || t("Details.noDescription")}
              </DialogDescription>
              <div className="flex flex-wrap gap-2">
                <Badge variant="primary-muted">{registration.agentSlug}</Badge>
                <Badge variant="secondary">{t("Discovery.inboxSource")}</Badge>
                <Badge variant="outline-muted">
                  {t("Discovery.metadataVersion", {
                    version: registration.metadataVersion,
                  })}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <DiscoveryDetailItem label={t("Discovery.inboxSlug")}>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">
                  {registration.agentSlug}
                </span>
                <CopyButton value={registration.agentSlug} />
              </div>
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("table.agentId")}>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono">
                  {registration.agentIdentifier}
                </span>
                <CopyButton value={registration.agentIdentifier} />
              </div>
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("Discovery.verifiedUpdated")}>
              {formatRelativeDate(registration.statusUpdatedAt)}
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("Discovery.added")}>
              {formatRelativeDate(registration.createdAt)}
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("Discovery.policyId")}>
              {policyId ? (
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-mono">
                    {policyId}
                  </span>
                  <CopyButton value={policyId} />
                </div>
              ) : (
                <span className="text-muted-foreground">
                  {t("Discovery.noPolicyId")}
                </span>
              )}
            </DiscoveryDetailItem>

            <DiscoveryDetailItem label={t("Discovery.source")} fullWidth>
              {sourceUrl ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-foreground hover:underline"
                  >
                    {sourceUrl}
                  </Link>
                  <CopyButton value={sourceUrl} />
                  <Button asChild variant="outline" size="sm2">
                    <Link href={sourceUrl} target="_blank" rel="noreferrer">
                      {t("Discovery.openSource")}
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <span className="text-muted-foreground">
                  {t("Discovery.noSourceUrl")}
                </span>
              )}
            </DiscoveryDetailItem>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InboxAgentListItem({
  registration,
  onViewDetails,
}: {
  registration: InboxAgentRegistration;
  onViewDetails: () => void;
}) {
  const t = useTranslations("App.Agents");
  const policyId = registration.RegistrySource.policyId;
  const shortDescription =
    registration.description?.trim() || t("Details.noDescription");

  return (
    <button
      type="button"
      onClick={onViewDetails}
      className="w-full rounded-xl border border-border/80 bg-card text-left shadow-sm transition-colors hover:border-primary/35 hover:bg-muted-surface/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
        <Avatar className="mt-0.5 h-10 w-10 border border-border/70">
          <AvatarFallback>{getInitials(registration.name)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-base">
              {registration.name}
            </span>
            <Badge
              variant={getInboxRegistrationBadgeVariant(registration.status)}
            >
              {registration.status}
            </Badge>
          </div>

          <p className="line-clamp-1 text-sm text-muted-foreground">
            {shortDescription}
          </p>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{registration.agentSlug}</span>
            <span className="text-border">{"\u2022"}</span>
            <span>{formatRelativeDate(registration.statusUpdatedAt)}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="primary-muted">{registration.agentSlug}</Badge>
            <Badge variant="outline-muted">
              {t("Discovery.metadataVersion", {
                version: registration.metadataVersion,
              })}
            </Badge>
            <Badge variant="outline-muted">
              {policyId
                ? shortenAddress(policyId, 8)
                : t("Discovery.noPolicyId")}
            </Badge>
          </div>
        </div>

        <div className="hidden items-center gap-2 self-center text-xs text-muted-foreground sm:flex">
          <span>{t("Discovery.viewDetails")}</span>
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </button>
  );
}

export function AgentsDiscovery() {
  const t = useTranslations("App.Agents");
  const router = useRouter();
  const { network } = usePaymentNetwork();
  const [activeTab, setActiveTab] = useState<DiscoveryTab>("agents");
  const [registryState, setRegistryState] = useState<
    CursorPageState<RegistryEntry>
  >(() => createCursorPageState<RegistryEntry>());
  const [inboxState, setInboxState] = useState<
    CursorPageState<InboxAgentRegistration>
  >(() => createCursorPageState<InboxAgentRegistration>());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedRegistryEntry, setSelectedRegistryEntry] =
    useState<RegistryEntry | null>(null);
  const [selectedInboxRegistration, setSelectedInboxRegistration] =
    useState<InboxAgentRegistration | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebouncedValue(searchQuery, 200);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key?.toLowerCase() !== "f") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      e.preventDefault();
      searchInputRef.current?.focus();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    setSelectedRegistryEntry(null);
    setSelectedInboxRegistration(null);
  }, [activeTab]);

  const fetchRegistryEntries = useCallback(
    async (cursorId?: string) =>
      registryDiscoveryClient.getRegistryEntries({
        network,
        limit: PAGE_SIZE,
        cursorId,
        filter: {
          status: ["Online"],
        },
      }),
    [network],
  );

  const fetchInboxRegistrations = useCallback(
    async (cursorId?: string) =>
      registryDiscoveryClient.getInboxAgentRegistrations({
        network,
        limit: PAGE_SIZE,
        cursorId,
        filter: {
          status: ["Pending", "Verified"],
        },
      }),
    [network],
  );

  const loadRegistryInitial = useCallback(async () => {
    setRegistryState((current) => ({
      ...current,
      isLoading: true,
      isPageLoading: false,
      error: null,
    }));

    const result = await fetchRegistryEntries();

    setRegistryState({
      pages: result.success ? [result.data.items] : [],
      nextCursors: result.success ? [result.data.nextCursor] : [],
      currentPage: 1,
      isLoading: false,
      isPageLoading: false,
      error: result.success ? null : result.error || t("Discovery.error"),
    });
  }, [fetchRegistryEntries, t]);

  const loadInboxInitial = useCallback(async () => {
    setInboxState((current) => ({
      ...current,
      isLoading: true,
      isPageLoading: false,
      error: null,
    }));

    const result = await fetchInboxRegistrations();

    setInboxState({
      pages: result.success ? [result.data.items] : [],
      nextCursors: result.success ? [result.data.nextCursor] : [],
      currentPage: 1,
      isLoading: false,
      isPageLoading: false,
      error: result.success ? null : result.error || t("Discovery.error"),
    });
  }, [fetchInboxRegistrations, t]);

  useEffect(() => {
    void Promise.all([loadRegistryInitial(), loadInboxInitial()]);
  }, [loadInboxInitial, loadRegistryInitial]);

  const loadRegistryPage = useCallback(
    async (page: number) => {
      if (registryState.isPageLoading) return;
      if (page < 1 || page > getKnownTotalPages(registryState)) return;

      if (page <= registryState.pages.length) {
        setRegistryState((current) => ({ ...current, currentPage: page }));
        return;
      }

      const cursor = registryState.nextCursors[registryState.pages.length - 1];
      if (!cursor) return;

      setRegistryState((current) => ({
        ...current,
        isPageLoading: true,
        error: null,
      }));

      try {
        const result = await fetchRegistryEntries(cursor);
        if (!result.success) {
          setRegistryState((current) => ({
            ...current,
            isPageLoading: false,
            error: result.error || t("Discovery.error"),
          }));
          return;
        }

        setRegistryState((current) => ({
          ...current,
          pages: [...current.pages, result.data.items],
          nextCursors: [...current.nextCursors, result.data.nextCursor],
          currentPage: page,
          isPageLoading: false,
        }));
      } catch (error) {
        setRegistryState((current) => ({
          ...current,
          isPageLoading: false,
          error: error instanceof Error ? error.message : t("Discovery.error"),
        }));
      }
    },
    [fetchRegistryEntries, registryState, t],
  );

  const loadInboxPage = useCallback(
    async (page: number) => {
      if (inboxState.isPageLoading) return;
      if (page < 1 || page > getKnownTotalPages(inboxState)) return;

      if (page <= inboxState.pages.length) {
        setInboxState((current) => ({ ...current, currentPage: page }));
        return;
      }

      const cursor = inboxState.nextCursors[inboxState.pages.length - 1];
      if (!cursor) return;

      setInboxState((current) => ({
        ...current,
        isPageLoading: true,
        error: null,
      }));

      try {
        const result = await fetchInboxRegistrations(cursor);
        if (!result.success) {
          setInboxState((current) => ({
            ...current,
            isPageLoading: false,
            error: result.error || t("Discovery.error"),
          }));
          return;
        }

        setInboxState((current) => ({
          ...current,
          pages: [...current.pages, result.data.items],
          nextCursors: [...current.nextCursors, result.data.nextCursor],
          currentPage: page,
          isPageLoading: false,
        }));
      } catch (error) {
        setInboxState((current) => ({
          ...current,
          isPageLoading: false,
          error: error instanceof Error ? error.message : t("Discovery.error"),
        }));
      }
    },
    [fetchInboxRegistrations, inboxState, t],
  );

  const registryPageItems = useMemo(
    () => getCurrentPageItems(registryState),
    [registryState],
  );
  const inboxPageItems = useMemo(
    () => getCurrentPageItems(inboxState),
    [inboxState],
  );

  const visibleRegistryEntries = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    return [...registryPageItems]
      .sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
      )
      .filter((entry) => matchesRegistryLookup(entry, query));
  }, [debouncedSearch, registryPageItems]);

  const visibleInboxRegistrations = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    return [...inboxPageItems]
      .sort(
        (left, right) =>
          new Date(right.statusUpdatedAt).getTime() -
          new Date(left.statusUpdatedAt).getTime(),
      )
      .filter((registration) => matchesInboxLookup(registration, query));
  }, [debouncedSearch, inboxPageItems]);

  const activeItems =
    activeTab === "agents" ? visibleRegistryEntries : visibleInboxRegistrations;
  const activePageItems =
    activeTab === "agents" ? registryPageItems : inboxPageItems;
  const activeState = activeTab === "agents" ? registryState : inboxState;
  const activeCurrentPage =
    activeTab === "agents" ? registryState.currentPage : inboxState.currentPage;
  const activeTotalPages =
    activeTab === "agents"
      ? getKnownTotalPages(registryState)
      : getKnownTotalPages(inboxState);
  const activePageChange =
    activeTab === "agents" ? loadRegistryPage : loadInboxPage;

  const handleRefresh = () => {
    setIsRefreshing(true);
    const refreshPromise =
      activeTab === "agents" ? loadRegistryInitial() : loadInboxInitial();
    refreshPromise.finally(() => setIsRefreshing(false));
  };

  const discoveryTabs = useMemo(
    () => [
      { name: t("Discovery.views.agents"), key: "agents" },
      { name: t("Discovery.views.inbox"), key: "inbox" },
    ],
    [t],
  );

  const summaryLabel = t("Discovery.resultsSummary", {
    visibleCount: activeItems.length,
    loadedCount: activePageItems.length,
  });

  const activeDescription =
    activeTab === "agents"
      ? t("Discovery.agentsDescription")
      : t("Discovery.inboxDescription");
  const activeFilterLabel =
    activeTab === "agents"
      ? t("Discovery.onlineOnly")
      : t("Discovery.pendingAndVerified");
  const activeSearchPlaceholder =
    activeTab === "agents"
      ? t("Discovery.searchPlaceholder")
      : t("Discovery.inboxSearchPlaceholder");
  const activeEmptyLabel = debouncedSearch
    ? activeTab === "agents"
      ? t("Discovery.emptySearch")
      : t("Discovery.inboxEmptySearch")
    : activeTab === "agents"
      ? t("Discovery.empty")
      : t("Discovery.inboxEmpty");

  const paginationLabels = {
    previous: t("Discovery.previous"),
    next: t("Discovery.next"),
    previousAriaLabel: t("Discovery.paginationPrevious"),
    nextAriaLabel: t("Discovery.paginationNext"),
    ellipsisSrText: t("Discovery.paginationMore"),
  };

  return (
    <Card className="overflow-hidden gap-0 py-0">
      <CardHeader className="border-b border-border/60 bg-masumi-gradient rounded-t-xl pt-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-base font-semibold">
              {t("Discovery.title")}
            </CardTitle>
            <CardDescription className="max-w-3xl leading-6">
              {t("Discovery.description")}
            </CardDescription>
          </div>
          <Badge variant="outline-muted">{network}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        <Tabs
          tabs={discoveryTabs}
          activeTab={activeTab}
          onTabChange={(tab) => {
            if (tab === "inbox") {
              router.push("/inbox-agents?section=discovery");
              return;
            }
            setActiveTab(tab as DiscoveryTab);
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">{activeFilterLabel}</Badge>
            <span className="text-sm text-muted-foreground">
              {activeDescription}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            {t("Discovery.page", { page: activeCurrentPage })}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div
            onClick={() => searchInputRef.current?.focus()}
            className="relative flex w-full max-w-xl cursor-text items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
          >
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="search"
              placeholder={activeSearchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className="h-6 min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
            {!isSearchFocused && (
              <kbd className="hidden sm:inline-flex h-6 shrink-0 items-center justify-center rounded-md border bg-muted px-2 font-mono text-xs text-foreground pointer-events-none">
                {t("searchShortcut")}
              </kbd>
            )}
          </div>

          <RefreshButton
            onRefresh={handleRefresh}
            size="md"
            isRefreshing={isRefreshing}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <div>{summaryLabel}</div>
        </div>

        {activeState.error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {activeState.error}
          </div>
        )}

        {activeState.isLoading ? (
          <DiscoverySkeleton />
        ) : (
          <>
            {activeState.isPageLoading && (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted-surface/50 px-4 py-3 text-sm text-muted-foreground">
                <Spinner size={14} />
                {t("loadingMore")}
              </div>
            )}

            {activeItems.length > 0 ? (
              <div className="space-y-3">
                {activeTab === "agents"
                  ? visibleRegistryEntries.map((entry) => (
                      <RegistryAgentListItem
                        key={entry.id}
                        entry={entry}
                        onViewDetails={() => setSelectedRegistryEntry(entry)}
                      />
                    ))
                  : visibleInboxRegistrations.map((registration) => (
                      <InboxAgentListItem
                        key={registration.id}
                        registration={registration}
                        onViewDetails={() =>
                          setSelectedInboxRegistration(registration)
                        }
                      />
                    ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted-surface/50 px-4 py-12 text-center">
                <p className="text-muted-foreground text-sm">
                  {activeEmptyLabel}
                </p>
              </div>
            )}

            <DiscoveryPaginationBar
              currentPage={activeCurrentPage}
              totalPages={activeTotalPages}
              isLoading={activeState.isPageLoading}
              onPageChange={(page) => {
                void activePageChange(page);
              }}
              labels={paginationLabels}
            />

            <RegistryEntryDetailsDialog
              entry={selectedRegistryEntry}
              open={selectedRegistryEntry !== null}
              onOpenChange={(open) => {
                if (!open) setSelectedRegistryEntry(null);
              }}
            />

            <InboxAgentDetailsDialog
              registration={selectedInboxRegistration}
              open={selectedInboxRegistration !== null}
              onOpenChange={(open) => {
                if (!open) setSelectedInboxRegistration(null);
              }}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
