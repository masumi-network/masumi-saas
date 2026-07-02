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
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFormatDate } from "@/hooks/use-format-date";
import { useKycStatusWithPolling } from "@/hooks/use-kyc-status-with-polling";
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
import {
  deriveVerificationPresentation,
  REGISTRY_UPDATE_PENDING_STATES,
} from "@/lib/registry/verification-display";
import { cn, shortenAddress } from "@/lib/utils";

import { RequestVerificationDialog } from "./request-verification-dialog";

const EM_DASH = "\u2014";

interface AgentVerificationCardProps {
  agent: Agent;
  onVerificationSuccess: () => void;
}

function monospaceRow({
  label,
  value,
  condensed,
}: {
  label: string;
  value: string;
  condensed?: boolean;
}) {
  const display =
    condensed && value.length > 28 ? shortenAddress(value, 10) : value;
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </dt>
      <dd className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right font-mono text-xs text-foreground sm:max-w-[min(100%,24rem)]">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="min-w-0 cursor-default truncate" title={value}>
              {display}
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
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-right text-xs">{children}</dd>
    </div>
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
  dbVerificationStatus,
  onChainStatus,
  loadState,
}: {
  registered: boolean;
  dbVerificationStatus: string;
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
      <CardContent className="border-t border-border/40 pt-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-tight text-muted-foreground">
          {tOnChain("sectionTitle")}
        </p>
        <p className="text-sm text-muted-foreground">
          {tOnChain("notRegistered")}
        </p>
      </CardContent>
    );
  }

  const showDbMismatch =
    dbVerificationStatus === "VERIFIED" &&
    onChainStatus?.registered &&
    !onChainStatus.hasAnchors &&
    onChainStatus.resolutionSource !== "on-chain" &&
    !(
      onChainStatus.registryState &&
      REGISTRY_UPDATE_PENDING_STATES.has(onChainStatus.registryState)
    );

  const showUpdateInProgressHint =
    onChainStatus?.registryState &&
    REGISTRY_UPDATE_PENDING_STATES.has(onChainStatus.registryState);

  return (
    <CardContent className="border-t border-border/40 pt-6">
      <p className="mb-4 text-xs font-semibold uppercase tracking-tight text-muted-foreground">
        {tOnChain("sectionTitle")}
      </p>
      {loadState === "loading" ? (
        <div className="flex justify-center py-10">
          <Spinner className="text-muted-foreground" />
        </div>
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
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <dt className="text-xs font-medium text-muted-foreground">
                {tOnChain("statusLabel")}
              </dt>
              <dd className="flex justify-end">
                <Badge variant={onChainStatusBadgeVariant(onChainStatus)}>
                  {onChainStatusLabel(onChainStatus, tOnChain)}
                </Badge>
              </dd>
            </div>

            {showDbMismatch ? (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                {tOnChain("dbOnChainMismatch")}
              </p>
            ) : null}

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
                  condensed: true,
                })
              : onChainStatus.credentialId
                ? monospaceRow({
                    label: tOnChain("credentialSaid"),
                    value: onChainStatus.credentialId,
                    condensed: true,
                  })
                : null}

            {onChainStatus.schemaSaid
              ? monospaceRow({
                  label: tOnChain("schemaSaid"),
                  value: onChainStatus.schemaSaid,
                  condensed: true,
                })
              : null}

            {onChainStatus.holderAid
              ? monospaceRow({
                  label: tOnChain("holderAid"),
                  value: onChainStatus.holderAid,
                  condensed: true,
                })
              : null}

            {onChainStatus.issuerAid
              ? monospaceRow({
                  label: tOnChain("issuerAid"),
                  value: onChainStatus.issuerAid,
                  condensed: true,
                })
              : null}

            {onChainStatus.queriedAgentIdentifier
              ? monospaceRow({
                  label: tOnChain("registryAgentId"),
                  value: onChainStatus.queriedAgentIdentifier,
                  condensed: true,
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
}: {
  agentId: string;
  currentRegistryAgentId: string | null | undefined;
  verificationStatus: string;
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
  }, [agentId, verificationStatus]);

  let registryConsistency: "match" | "mismatch" | "neutral" | null = null;
  if (credSummary?.claimedRegistryAgentIdentifier && currentRegistryAgentId) {
    registryConsistency =
      credSummary.claimedRegistryAgentIdentifier === currentRegistryAgentId
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
        <div className="flex justify-center py-10">
          <Spinner className="text-muted-foreground" />
        </div>
      ) : credLoadState === "error" ? (
        <p className="text-sm text-destructive">{tCred("loadError")}</p>
      ) : !credSummary ? (
        <p className="text-sm text-muted-foreground">{tCred("emptyHint")}</p>
      ) : (
        <dl className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <dt className="text-xs font-medium text-muted-foreground">
              {tCred("credentialDbStatus")}
            </dt>
            <dd className="flex justify-end">
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
            condensed: true,
          })}
          {monospaceRow({
            label: tCred("recipientAid"),
            value: credSummary.aid,
            condensed: true,
          })}
          {monospaceRow({
            label: tCred("localRecordId"),
            value: credSummary.localCredentialRecordId,
          })}

          {plainRow({
            label: tCred("credentialAgentDisplayName"),
            children: credSummary.credentialAgentDisplayName?.trim() ? (
              <span className="break-words text-sm text-foreground">
                {credSummary.credentialAgentDisplayName}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {EM_DASH} <span className="italic">{tCred("notProvided")}</span>
              </span>
            ),
          })}

          {plainRow({
            label: tCred("credentialAgentApiUrl"),
            children: credSummary.credentialAgentApiUrl?.trim() ? (
              <Link
                href={credSummary.credentialAgentApiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-start gap-1 text-sm text-primary underline-offset-4 hover:underline"
              >
                <span className="break-all text-left">
                  {credSummary.credentialAgentApiUrl}
                </span>
                <ExternalLink
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden
                />
              </Link>
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
                condensed: true,
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
                condensed: true,
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
  const [onChainStatus, setOnChainStatus] =
    useState<AgentOnChainVerificationStatus | null>(null);
  const [onChainLoadState, setOnChainLoadState] = useState<
    "loading" | "ok" | "error"
  >("ok");
  const { kycStatus, isLoadingKyc } = useKycStatusWithPolling(
    agentVerificationEnabled,
  );

  const dbStatus = agent.verificationStatus || "PENDING";
  const isRegistrationConfirmed =
    agent.registrationState === "RegistrationConfirmed";
  const hasRegistryIdentifier = Boolean(agent.agentIdentifier?.trim());
  const registered = isRegistrationConfirmed && hasRegistryIdentifier;

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
    <Card className="overflow-hidden pt-0">
      <CardHeader className="bg-masumi-gradient rounded-t-xl pt-6">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-5 w-5", config.iconColor)} />
          <CardTitle className="text-sm font-medium">{config.title}</CardTitle>
        </div>
        <CardDescription className="mt-2">{config.description}</CardDescription>
      </CardHeader>

      <OnChainVerificationPanel
        registered={registered}
        dbVerificationStatus={dbStatus}
        onChainStatus={effectiveOnChainStatus}
        loadState={effectiveOnChainLoadState}
      />

      {showCredPanel ? (
        <VeridianCredentialSummaryPanel
          agentId={agent.id}
          currentRegistryAgentId={agent.agentIdentifier}
          verificationStatus={dbStatus}
        />
      ) : null}

      {config.showButton ? (
        <CardFooter>
          {isLoadingKyc ? (
            <Button variant="primary" className="w-full" disabled>
              {t("loading")}
            </Button>
          ) : kycStatus === "APPROVED" && !isRegistrationConfirmed ? (
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
