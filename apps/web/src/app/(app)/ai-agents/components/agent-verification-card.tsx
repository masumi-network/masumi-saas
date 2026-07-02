"use client";

import {
  AlertCircle,
  Clock,
  ExternalLink,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFormatDate } from "@/hooks/use-format-date";
import { useKycStatusWithPolling } from "@/hooks/use-kyc-status-with-polling";
import {
  isAgentLiveOnRegistry,
  isRegistrationConfirmedOnNetwork,
} from "@/lib/agents/registration-state";
import {
  type Agent,
  agentApiClient,
  type AgentOnChainVerificationStatus,
  type AgentVerificationCredentialSummary,
} from "@/lib/api/agent.client";
import {
  isAgentVerificationFlowEnabled,
  verifiableCredentialsSdkDocUrl,
} from "@/lib/config/verification.config";
import { credentialMatchesAgentRegistryId } from "@/lib/registry/stored-credential-attributes";
import {
  deriveVerificationPresentation,
  REGISTRY_UPDATE_PENDING_STATES,
} from "@/lib/registry/verification-display";
import { cn } from "@/lib/utils";

import { RequestVerificationDialog } from "./request-verification-dialog";

const EM_DASH = "\u2014";

interface AgentVerificationCardProps {
  agent: Agent;
  onVerificationSuccess: () => void;
}

function detailRowLabel(label: string) {
  return (
    <dt className="min-w-0 max-w-[45%] shrink text-xs font-medium text-muted-foreground">
      {label}
    </dt>
  );
}

function monospaceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      {detailRowLabel(label)}
      <dd className="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-hidden">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="block min-w-0 cursor-default truncate font-mono text-xs text-foreground">
              {value}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-md break-all">
            <p className="font-mono text-xs">{value}</p>
          </TooltipContent>
        </Tooltip>
        <CopyButton value={value} className="h-7 w-7 shrink-0" />
      </dd>
    </div>
  );
}

function plainRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      {detailRowLabel(label)}
      <dd className="flex min-w-0 flex-1 items-center justify-end overflow-hidden text-xs">
        {children}
      </dd>
    </div>
  );
}

function VerificationSectionSkeleton({
  rowCount,
  badgeFirstRow = false,
}: {
  rowCount: number;
  badgeFirstRow?: boolean;
}) {
  const labelWidths = ["w-24", "w-28", "w-32", "w-20", "w-36", "w-24", "w-28"];
  const valueWidths = ["w-36", "w-40", "w-32", "w-44", "w-28", "w-36", "w-40"];

  return (
    <dl className="space-y-3" aria-hidden>
      {Array.from({ length: rowCount }).map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-4">
          <Skeleton
            className={cn("h-3", labelWidths[index % labelWidths.length])}
          />
          {badgeFirstRow && index === 0 ? (
            <Skeleton className="h-5 w-32 rounded-full" />
          ) : (
            <Skeleton
              className={cn(
                "h-3 min-w-0 flex-1",
                valueWidths[index % valueWidths.length],
              )}
            />
          )}
        </div>
      ))}
    </dl>
  );
}

function onChainStatusBadgeVariant(
  status: AgentOnChainVerificationStatus,
): "default" | "secondary" | "destructive" {
  if (
    status.registryState &&
    REGISTRY_UPDATE_PENDING_STATES.has(status.registryState)
  ) {
    return "secondary";
  }
  if (status.verified && status.resolutionSource === "on-chain") {
    return "default";
  }
  if (status.verified && status.resolutionSource === "database") {
    return "secondary";
  }
  if (status.hasAnchors) {
    return "destructive";
  }
  return "secondary";
}

function onChainStatusLabel(
  status: AgentOnChainVerificationStatus,
  t: ReturnType<
    typeof useTranslations<"App.Agents.Details.Verification.onChainSummary">
  >,
): string {
  if (
    status.registryState &&
    REGISTRY_UPDATE_PENDING_STATES.has(status.registryState)
  ) {
    return t("statusUpdateInProgress");
  }
  if (status.verified && status.resolutionSource === "on-chain") {
    return t("statusVerified");
  }
  if (status.verified && status.resolutionSource === "database") {
    return t("statusDbOnly");
  }
  if (status.hasAnchors) {
    return t("statusAnchorsInvalid");
  }
  return t("statusAnchorsPending");
}

function OnChainVerificationPanel({
  registered,
  onChainStatus,
  loadState,
}: {
  registered: boolean;
  onChainStatus: AgentOnChainVerificationStatus | null;
  loadState: "loading" | "ok" | "error";
}) {
  const tOnChain = useTranslations(
    "App.Agents.Details.Verification.onChainSummary",
  );
  const { formatDate: formatDt, formatRelativeDate: formatRel } =
    useFormatDate();

  if (!registered) {
    return (
      <CardContent className="pt-6 pb-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-tight text-muted-foreground">
          {tOnChain("sectionTitle")}
        </p>
        <p className="text-sm text-muted-foreground">
          {tOnChain("notRegistered")}
        </p>
      </CardContent>
    );
  }

  const showUpdateInProgressHint =
    onChainStatus?.registryState &&
    REGISTRY_UPDATE_PENDING_STATES.has(onChainStatus.registryState);

  return (
    <CardContent className="pt-6 pb-6">
      <p className="mb-4 text-xs font-semibold uppercase tracking-tight text-muted-foreground">
        {tOnChain("sectionTitle")}
      </p>
      {loadState === "loading" ? (
        <VerificationSectionSkeleton rowCount={6} badgeFirstRow />
      ) : loadState === "error" ? (
        <p className="text-sm text-destructive">{tOnChain("loadError")}</p>
      ) : !onChainStatus ? null : (
        <>
          {!onChainStatus.configured ? (
            <p className="mb-3 text-sm text-muted-foreground">
              {tOnChain("unavailable")}
            </p>
          ) : null}
          <dl className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <dt className="min-w-0 max-w-[45%] shrink text-xs font-medium text-muted-foreground">
                {tOnChain("statusLabel")}
              </dt>
              <dd className="flex justify-end">
                <Badge variant={onChainStatusBadgeVariant(onChainStatus)}>
                  {onChainStatusLabel(onChainStatus, tOnChain)}
                </Badge>
              </dd>
            </div>

            {showUpdateInProgressHint ? (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                {tOnChain("updateInProgressHint")}
              </p>
            ) : null}

            {onChainStatus.resolutionSource
              ? plainRow({
                  label: tOnChain("resolutionSource"),
                  children: (
                    <Badge variant="outline">
                      {onChainStatus.resolutionSource === "on-chain"
                        ? tOnChain("sourceOnChain")
                        : tOnChain("sourceDatabase")}
                    </Badge>
                  ),
                })
              : null}

            {onChainStatus.credentialSaid
              ? monospaceRow({
                  label: tOnChain("credentialSaid"),
                  value: onChainStatus.credentialSaid,
                })
              : onChainStatus.credentialId
                ? monospaceRow({
                    label: tOnChain("credentialSaid"),
                    value: onChainStatus.credentialId,
                  })
                : null}

            {onChainStatus.schemaSaid
              ? monospaceRow({
                  label: tOnChain("schemaSaid"),
                  value: onChainStatus.schemaSaid,
                })
              : null}

            {onChainStatus.holderAid
              ? monospaceRow({
                  label: tOnChain("holderAid"),
                  value: onChainStatus.holderAid,
                })
              : null}

            {onChainStatus.issuerAid
              ? monospaceRow({
                  label: tOnChain("issuerAid"),
                  value: onChainStatus.issuerAid,
                })
              : null}

            {onChainStatus.queriedAgentIdentifier
              ? monospaceRow({
                  label: tOnChain("registryAgentId"),
                  value: onChainStatus.queriedAgentIdentifier,
                })
              : null}

            {onChainStatus.verified || onChainStatus.expiresAt
              ? plainRow({
                  label: tOnChain("expiresAt"),
                  children: onChainStatus.expiresAt ? (
                    <span className="text-sm tabular-nums">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-default">
                            {formatRel(onChainStatus.expiresAt)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {formatDt(onChainStatus.expiresAt)}
                        </TooltipContent>
                      </Tooltip>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {tOnChain("expiresNever")}
                    </span>
                  ),
                })
              : null}
          </dl>
        </>
      )}
    </CardContent>
  );
}

function VeridianCredentialSummaryPanel({
  agentId,
  currentRegistryAgentId,
  verificationStatus,
  refreshKey,
}: {
  agentId: string;
  currentRegistryAgentId: string | null | undefined;
  verificationStatus: string;
  refreshKey: number;
}) {
  const tCred = useTranslations(
    "App.Agents.Details.Verification.credentialSummary",
  );
  const tCredStatus = useTranslations(
    "App.Agents.Details.Verification.credentialStatuses",
  );
  const { formatDate: formatDt, formatRelativeDate: formatRel } =
    useFormatDate();

  const [credSummary, setCredSummary] =
    useState<AgentVerificationCredentialSummary | null>(null);
  const [credLoadState, setCredLoadState] = useState<
    "loading" | "ok" | "error"
  >("loading");

  useEffect(() => {
    let cancelled = false;

    async function fetchSummary() {
      setCredLoadState("loading");
      const res =
        await agentApiClient.getVerificationCredentialSummary(agentId);
      if (cancelled) return;
      if (res.success) {
        setCredSummary(res.data ?? null);
        setCredLoadState("ok");
      } else {
        setCredSummary(null);
        setCredLoadState("error");
      }
    }

    fetchSummary();

    return () => {
      cancelled = true;
    };
  }, [agentId, verificationStatus, refreshKey]);

  let registryConsistency: "match" | "mismatch" | "neutral" | null = null;
  if (credSummary?.claimedRegistryAgentIdentifier && currentRegistryAgentId) {
    registryConsistency = credentialMatchesAgentRegistryId(
      credSummary.claimedRegistryAgentIdentifier,
      currentRegistryAgentId,
    )
      ? "match"
      : "mismatch";
  }

  const credStatusTone = (
    s: AgentVerificationCredentialSummary["credentialStatus"],
  ) => {
    if (s === "ISSUED") return "default" as const;
    if (s === "PENDING") return "secondary" as const;
    if (s === "REVOKED" || s === "EXPIRED") return "destructive" as const;
    return "secondary" as const;
  };

  return (
    <CardContent className="border-t border-border/40 pt-6">
      <p className="mb-4 text-xs font-semibold uppercase tracking-tight text-muted-foreground">
        {tCred("sectionTitle")}
      </p>
      {credLoadState === "loading" ? (
        <VerificationSectionSkeleton rowCount={10} badgeFirstRow />
      ) : credLoadState === "error" ? (
        <p className="text-sm text-destructive">{tCred("loadError")}</p>
      ) : !credSummary ? (
        <p className="text-sm text-muted-foreground">{tCred("emptyHint")}</p>
      ) : (
        <dl className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <dt className="min-w-0 max-w-[45%] shrink text-xs font-medium text-muted-foreground">
              {tCred("credentialDbStatus")}
            </dt>
            <dd className="flex min-w-0 flex-1 justify-end">
              <Badge variant={credStatusTone(credSummary.credentialStatus)}>
                {tCredStatus(credSummary.credentialStatus)}
              </Badge>
            </dd>
          </div>

          {credSummary.credentialId.startsWith("pending-") ? (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {tCred("pendingPlaceholder")}
            </p>
          ) : null}

          {monospaceRow({
            label: tCred("credentialId"),
            value: credSummary.credentialId,
          })}
          {monospaceRow({
            label: tCred("schemaSaid"),
            value: credSummary.schemaSaid,
          })}
          {monospaceRow({
            label: tCred("recipientAid"),
            value: credSummary.aid,
          })}
          {monospaceRow({
            label: tCred("localRecordId"),
            value: credSummary.localCredentialRecordId,
          })}

          {plainRow({
            label: tCred("credentialAgentDisplayName"),
            children: credSummary.credentialAgentDisplayName?.trim() ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block min-w-0 truncate text-sm text-foreground">
                    {credSummary.credentialAgentDisplayName}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {credSummary.credentialAgentDisplayName}
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="text-muted-foreground">
                {EM_DASH} <span className="italic">{tCred("notProvided")}</span>
              </span>
            ),
          })}

          {plainRow({
            label: tCred("credentialAgentApiUrl"),
            children: credSummary.credentialAgentApiUrl?.trim() ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={credSummary.credentialAgentApiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 items-center justify-end gap-1 overflow-hidden text-sm text-primary underline-offset-4 hover:underline"
                  >
                    <span className="min-w-0 truncate">
                      {credSummary.credentialAgentApiUrl}
                    </span>
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                  </Link>
                </TooltipTrigger>
                <TooltipContent className="max-w-md break-all">
                  {credSummary.credentialAgentApiUrl}
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="text-muted-foreground">
                {EM_DASH} <span className="italic">{tCred("notProvided")}</span>
              </span>
            ),
          })}

          {credSummary.claimedRegistryAgentIdentifier
            ? monospaceRow({
                label: tCred("claimedRegistryAgentId"),
                value: credSummary.claimedRegistryAgentIdentifier,
              })
            : plainRow({
                label: tCred("claimedRegistryAgentId"),
                children: (
                  <span className="text-muted-foreground">
                    {EM_DASH}{" "}
                    <span className="italic">{tCred("notProvided")}</span>
                  </span>
                ),
              })}

          {currentRegistryAgentId
            ? monospaceRow({
                label: tCred("currentRegistryAgentId"),
                value: currentRegistryAgentId,
              })
            : plainRow({
                label: tCred("currentRegistryAgentId"),
                children: (
                  <span className="text-muted-foreground">
                    {EM_DASH}{" "}
                    <span className="italic">{tCred("notRegisteredYet")}</span>
                  </span>
                ),
              })}

          {registryConsistency === "match" ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-500">
              {tCred("registryMatch")}
            </p>
          ) : registryConsistency === "mismatch" ? (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {tCred("registryMismatch")}
            </p>
          ) : null}

          <Separator />

          {plainRow({
            label: tCred("issuedAt"),
            children: (
              <span className="text-sm tabular-nums">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-default">
                      {formatRel(credSummary.issuedAt)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {formatDt(credSummary.issuedAt)}
                  </TooltipContent>
                </Tooltip>
              </span>
            ),
          })}

          {plainRow({
            label: tCred("expiresAt"),
            children: credSummary.expiresAt ? (
              <span className="text-sm tabular-nums">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-default">
                      {formatRel(credSummary.expiresAt)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {formatDt(credSummary.expiresAt)}
                  </TooltipContent>
                </Tooltip>
              </span>
            ) : (
              <span className="text-muted-foreground">
                {tCred("expiresNever")}
              </span>
            ),
          })}

          {plainRow({
            label: tCred("revokedAt"),
            children: credSummary.revokedAt ? (
              <span className="text-sm tabular-nums">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-default">
                      {formatRel(credSummary.revokedAt)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {formatDt(credSummary.revokedAt)}
                  </TooltipContent>
                </Tooltip>
              </span>
            ) : (
              <span className="text-muted-foreground">
                {tCred("revokedNever")}
              </span>
            ),
          })}

          {plainRow({
            label: tCred("lastUpdated"),
            children: (
              <span className="text-sm tabular-nums">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-default">
                      {formatRel(credSummary.lastUpdatedAt)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {formatDt(credSummary.lastUpdatedAt)}
                  </TooltipContent>
                </Tooltip>
              </span>
            ),
          })}

          <Separator />

          <Link
            href={verifiableCredentialsSdkDocUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-4 hover:text-primary/90"
          >
            {tCred("identityDocsLink")}
            <ExternalLink className="size-3.5 shrink-0" aria-hidden />
          </Link>
        </dl>
      )}
    </CardContent>
  );
}

export function AgentVerificationCard({
  agent,
  onVerificationSuccess,
}: AgentVerificationCardProps) {
  const agentVerificationEnabled = isAgentVerificationFlowEnabled();
  const t = useTranslations("App.Agents.Details.Verification");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [onChainRefreshKey, setOnChainRefreshKey] = useState(0);
  const [credRefreshKey, setCredRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [onChainStatus, setOnChainStatus] =
    useState<AgentOnChainVerificationStatus | null>(null);
  const [onChainLoadState, setOnChainLoadState] = useState<
    "loading" | "ok" | "error"
  >("ok");
  const { kycStatus, isLoadingKyc } = useKycStatusWithPolling(
    agentVerificationEnabled,
  );

  const dbStatus = agent.verificationStatus || "PENDING";
  const hasRegistryIdentifier = Boolean(agent.agentIdentifier?.trim());
  const registered =
    hasRegistryIdentifier && isAgentLiveOnRegistry(agent.registrationState);

  useEffect(() => {
    if (!registered) return;

    let cancelled = false;

    async function fetchStatus() {
      setOnChainLoadState("loading");
      const res = await agentApiClient.getOnChainVerificationStatus(agent.id);
      if (cancelled) return;
      if (res.success) {
        setOnChainStatus(res.data);
        setOnChainLoadState("ok");
      } else {
        setOnChainStatus(null);
        setOnChainLoadState("error");
      }
    }

    fetchStatus();

    return () => {
      cancelled = true;
    };
  }, [agent.id, registered, onChainRefreshKey]);

  const effectiveOnChainStatus = registered ? onChainStatus : null;
  const effectiveOnChainLoadState = registered ? onChainLoadState : "ok";

  const presentation = deriveVerificationPresentation({
    dbStatus,
    onChain: effectiveOnChainStatus,
  });

  const showCredPanel =
    dbStatus === "VERIFIED" || dbStatus === "REVOKED" || dbStatus === "EXPIRED";

  const handleRefresh = async () => {
    setIsRefreshing(true);
    onVerificationSuccess();
    setCredRefreshKey((key) => key + 1);

    try {
      if (registered) {
        setOnChainLoadState("loading");
        const res = await agentApiClient.getOnChainVerificationStatus(agent.id);
        if (res.success) {
          setOnChainStatus(res.data);
          setOnChainLoadState("ok");
        } else {
          setOnChainStatus(null);
          setOnChainLoadState("error");
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleVerificationSuccess = () => {
    setOnChainRefreshKey((key) => key + 1);
    onVerificationSuccess();
  };

  if (!agentVerificationEnabled) {
    return null;
  }

  const statusConfig = {
    PENDING: {
      icon: AlertCircle,
      iconColor: "text-muted-foreground",
      title: t("pending.title"),
      description: t("pending.description"),
      showButton: true,
    },
    VERIFIED: {
      icon: ShieldCheck,
      iconColor: "text-green-500",
      title: t("verified.title"),
      description: t("verified.description"),
      showButton: false,
    },
    updateInProgress: {
      icon: Clock,
      iconColor: "text-amber-500",
      title: t("updateInProgress.title"),
      description: t("updateInProgress.description"),
      showButton: false,
    },
    onChainPending: {
      icon: Clock,
      iconColor: "text-amber-500",
      title: t("onChainPending.title"),
      description: t("onChainPending.description"),
      showButton: false,
    },
    REVOKED: {
      icon: XCircle,
      iconColor: "text-destructive",
      title: t("revoked.title"),
      description: t("revoked.description"),
      showButton: true,
    },
    EXPIRED: {
      icon: Clock,
      iconColor: "text-orange-500",
      title: t("expired.title"),
      description: t("expired.description"),
      showButton: true,
    },
  };

  const presentationConfigKey =
    presentation === "verifiedOnChain"
      ? "VERIFIED"
      : presentation === "updateInProgress"
        ? "updateInProgress"
        : presentation === "onChainPending"
          ? "onChainPending"
          : presentation === "revoked"
            ? "REVOKED"
            : presentation === "expired"
              ? "EXPIRED"
              : "PENDING";

  const config =
    statusConfig[presentationConfigKey as keyof typeof statusConfig] ||
    statusConfig.PENDING;
  const Icon = config.icon;

  return (
    <Card className="overflow-hidden gap-0 py-0 pb-6">
      <CardHeader className="border-b border-border/50 bg-masumi-gradient rounded-t-xl p-6">
        <div className="flex w-full flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Icon className={cn("h-5 w-5 shrink-0", config.iconColor)} />
              <CardTitle className="text-sm font-medium">
                {config.title}
              </CardTitle>
            </div>
            <RefreshButton
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
              className="shrink-0 border-border/40 bg-background/10 hover:bg-background/20"
              aria-label={t("refreshStatus")}
            />
          </div>
          {presentationConfigKey !== "updateInProgress" &&
          presentationConfigKey !== "onChainPending" ? (
            <CardDescription>{config.description}</CardDescription>
          ) : null}
        </div>
      </CardHeader>

      <OnChainVerificationPanel
        registered={registered}
        onChainStatus={effectiveOnChainStatus}
        loadState={effectiveOnChainLoadState}
      />

      {showCredPanel ? (
        <VeridianCredentialSummaryPanel
          agentId={agent.id}
          currentRegistryAgentId={agent.agentIdentifier}
          verificationStatus={dbStatus}
          refreshKey={credRefreshKey}
        />
      ) : null}

      {config.showButton ? (
        <CardFooter>
          {isLoadingKyc ? (
            <Button variant="primary" className="w-full" disabled>
              {t("loading")}
            </Button>
          ) : kycStatus === "APPROVED" &&
            !isRegistrationConfirmedOnNetwork(agent.registrationState) ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block w-full cursor-not-allowed">
                  <Button
                    type="button"
                    variant="primary"
                    className="w-full pointer-events-none"
                    disabled
                  >
                    {t("requestVerification")}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                {t("tooltipRequestCredentialRequiresRegistration")}
              </TooltipContent>
            </Tooltip>
          ) : kycStatus === "APPROVED" ? (
            <Button
              variant="primary"
              onClick={() => setDialogOpen(true)}
              className="w-full"
            >
              {t("requestVerification")}
            </Button>
          ) : (
            <Button variant="primary" className="w-full" asChild>
              <Link href="/verification">{t("completeKyc")}</Link>
            </Button>
          )}
        </CardFooter>
      ) : null}

      <RequestVerificationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agent={agent}
        kycStatus={kycStatus}
        onSuccess={handleVerificationSuccess}
      />
    </Card>
  );
}
