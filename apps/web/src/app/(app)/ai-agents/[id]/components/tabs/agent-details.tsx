"use client";

import {
  CircleHelp,
  DollarSign,
  Fingerprint,
  Link2,
  Pencil,
  ShieldCheck,
  Tag,
  Tags,
  Trash2,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { RefreshButton } from "@/components/ui/refresh-button";
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
  canDeregisterAgent,
  canEditAgentDetails,
  isRegistrationConfirmedOnNetwork,
  isRegistrationUiPending,
  isRegistryVerificationUpdatePending,
} from "@/lib/agents/registration-state";
import { type Agent } from "@/lib/api/agent.client";
import { isAgentVerificationFlowEnabled } from "@/lib/config/verification.config";
import { agentPricingRequiresPayoutAddress } from "@/lib/schemas/agent";
import { cn, formatPricingDisplay, shortenAddress } from "@/lib/utils";

import {
  getRegistrationStatusBadgeClassName,
  getRegistrationStatusBadgeVariant,
  getRegistrationStatusDisplayKey,
} from "../../../components/agent-utils";
import {
  AgentX402Options,
  shouldShowAgentX402Options,
} from "../../../components/agent-x402-options";
import { RequestVerificationDialog } from "../../../components/request-verification-dialog";
import { AgentPayoutAddressDialog } from "../agent-payout-address-dialog";
import { AgentVerificationOverviewLine } from "../agent-verification-overview-line";
import { EditAgentDialog } from "../edit-agent-dialog";

interface AgentDetailsProps {
  agent: Agent;
  onDeleteClick: () => void;
  onDeregisterClick: () => void;
  onVerificationSuccess?: () => void | Promise<void>;
  onRefreshStatus?: () => void | Promise<void>;
  onVerificationDialogClosed?: () => void;
  onAgentUpdated?: (agent: Agent) => void;
  onViewVerificationTab?: () => void;
}

const STUCK_PENDING_MS = 2 * 60 * 1000;

export function AgentDetails({
  agent,
  onDeleteClick,
  onDeregisterClick,
  onVerificationSuccess,
  onRefreshStatus,
  onVerificationDialogClosed,
  onAgentUpdated,
  onViewVerificationTab,
}: AgentDetailsProps) {
  // Avoid Date.now() during render (impure). Use state updated in effect so "stuck" appears after ~2 min.
  const [now, setNow] = useState(0);
  useEffect(() => {
    // Defer initial setState to satisfy react-hooks/set-state-in-effect (no sync setState in effect body)
    const initialId = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      clearTimeout(initialId);
      clearInterval(id);
    };
  }, []);
  const t = useTranslations("App.Agents.Details");
  const tRegister = useTranslations("App.Agents.Register");
  const tRegistrationStatus = useTranslations("App.Agents.registrationStatus");
  const tVerification = useTranslations("App.Agents.Details.Verification");
  const { formatDate, formatRelativeDate } = useFormatDate();
  const agentVerificationEnabled = isAgentVerificationFlowEnabled();
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const { kycStatus, isLoadingKyc } = useKycStatusWithPolling(
    agentVerificationEnabled,
  );

  const isVerified = agent.verificationStatus === "VERIFIED";
  const isRegistrationConfirmed = isRegistrationConfirmedOnNetwork(
    agent.registrationState,
  );
  const registrationBadgeVariant = isRegistrationConfirmed
    ? ("success" as const)
    : getRegistrationStatusBadgeVariant(agent.registrationState);
  const showVerificationCta =
    agentVerificationEnabled && !isVerified && isRegistrationConfirmed;

  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);

  const handleRefreshStatus = useCallback(async () => {
    if (!onRefreshStatus) return;
    setIsRefreshingStatus(true);
    try {
      await onRefreshStatus();
    } finally {
      setIsRefreshingStatus(false);
    }
  }, [onRefreshStatus]);

  const showRegistrationRefresh =
    Boolean(onRefreshStatus) &&
    isRegistrationUiPending(agent.registrationState);

  const showVerificationBanner =
    showVerificationCta && Boolean(onVerificationSuccess);

  const [isPayoutDialogOpen, setIsPayoutDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const requiresPayoutAddress = agentPricingRequiresPayoutAddress(
    agent.pricing,
  );
  const showPayoutAddressBanner = requiresPayoutAddress && !agent.payoutAddress;
  const showEditButton =
    isRegistrationConfirmedOnNetwork(agent.registrationState) &&
    Boolean(agent.agentIdentifier) &&
    !isRegistryVerificationUpdatePending(agent.registrationState) &&
    canEditAgentDetails({
      registrationState: agent.registrationState,
      agentIdentifier: agent.agentIdentifier,
      updatedAt: new Date(agent.updatedAt),
    });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      {showPayoutAddressBanner || showVerificationBanner ? (
        <div className="overflow-hidden rounded-lg border border-border/80 bg-muted/20 divide-y divide-border/80">
          {showPayoutAddressBanner ? (
            <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <p className="text-sm text-muted-foreground">
                  {t("payoutAddressMissing")}
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex shrink-0 cursor-help text-muted-foreground hover:text-foreground">
                      <CircleHelp className="h-3.5 w-3.5" />
                      <span className="sr-only">
                        {tRegister("payoutAddressHint")}
                      </span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    {tRegister("payoutAddressHint")}
                  </TooltipContent>
                </Tooltip>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="shrink-0"
                onClick={() => setIsPayoutDialogOpen(true)}
              >
                {t("payoutAddressSet")}
              </Button>
            </div>
          ) : null}
          {showVerificationBanner ? (
            <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <p className="text-sm text-muted-foreground">
                  {t("verificationPromptDescription")}
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex shrink-0 cursor-help text-muted-foreground hover:text-foreground">
                      <CircleHelp className="h-3.5 w-3.5" />
                      <span className="sr-only">
                        {t("verificationPromptTooltip")}
                      </span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    {t("verificationPromptTooltip")}
                  </TooltipContent>
                </Tooltip>
              </div>
              {isLoadingKyc ? (
                <Button
                  variant="primary"
                  size="sm"
                  disabled
                  className="shrink-0"
                >
                  <Spinner size={14} className="mr-2" />
                  {tVerification("loading")}
                </Button>
              ) : kycStatus === "APPROVED" ? (
                <Button
                  variant="primary"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setVerificationDialogOpen(true)}
                >
                  {tVerification("requestVerification")}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  className="shrink-0"
                  asChild
                >
                  <Link href="/verification">
                    {tVerification("completeKyc")}
                  </Link>
                </Button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        <Card className="overflow-hidden gap-0 py-0">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-masumi-gradient rounded-t-xl pt-6 p-6">
            <CardTitle className="text-base font-semibold">
              {t("overview")}
            </CardTitle>
            <div className="flex shrink-0 items-center gap-1">
              {showEditButton ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5"
                  onClick={() => setIsEditDialogOpen(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {t("edit")}
                </Button>
              ) : null}
              <Badge
                variant={registrationBadgeVariant}
                className={cn(
                  "shrink-0",
                  getRegistrationStatusBadgeClassName(agent.registrationState),
                )}
              >
                {tRegistrationStatus(
                  getRegistrationStatusDisplayKey(agent.registrationState),
                )}
              </Badge>
              {showRegistrationRefresh ? (
                <RefreshButton
                  onRefresh={handleRefreshStatus}
                  isRefreshing={isRefreshingStatus}
                  buttonVariant="ghost"
                  size="sm"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  aria-label={t("refresh")}
                />
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            {/* Description (short) */}
            {agent.description && (
              <>
                <div className="flex gap-3">
                  <Tag className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t("description")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {agent.description}
                    </p>
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* API URL - compact row */}
            <div className="flex gap-3 min-w-0">
              <Link2 className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("apiUrl")}
                </p>
                <div className="flex items-center gap-2 min-w-0">
                  <Link
                    href={agent.apiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs sm:text-sm hover:underline truncate min-w-0"
                  >
                    {agent.apiUrl}
                  </Link>
                  <CopyButton
                    value={agent.apiUrl}
                    className="h-7 w-7 shrink-0"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Agent ID */}
            <div className="flex gap-3 min-w-0">
              <Fingerprint className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("agentId")}
                </p>
                <div className="flex items-center gap-2 min-w-0">
                  {agent.agentIdentifier ? (
                    <>
                      <span className="font-mono text-xs sm:text-sm truncate min-w-0">
                        {agent.agentIdentifier}
                      </span>
                      <CopyButton
                        value={agent.agentIdentifier}
                        className="h-7 w-7 shrink-0"
                      />
                    </>
                  ) : (
                    <span className="text-xs sm:text-sm text-muted-foreground">
                      {t("noAgentId")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Price */}
            <div className="flex gap-3 min-w-0">
              <DollarSign className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("price")}
                </p>
                <p className="text-sm">{formatPricingDisplay(agent.pricing)}</p>
              </div>
            </div>

            <Separator />

            {requiresPayoutAddress ? (
              <>
                {/* Payout address */}
                <div className="flex gap-3 min-w-0">
                  <Wallet className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("payoutAddress")}
                      </p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
                            <CircleHelp className="h-3.5 w-3.5" />
                            <span className="sr-only">
                              {tRegister("payoutAddressHint")}
                            </span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          {tRegister("payoutAddressHint")}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      {agent.payoutAddress ? (
                        <>
                          <span
                            className="font-mono text-xs sm:text-sm truncate min-w-0"
                            title={agent.payoutAddress}
                          >
                            {shortenAddress(agent.payoutAddress, 10)}
                          </span>
                          <CopyButton
                            value={agent.payoutAddress}
                            className="h-7 w-7 shrink-0"
                          />
                        </>
                      ) : (
                        <span className="text-xs sm:text-sm text-muted-foreground">
                          {t("payoutAddressNotSet")}
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7"
                        onClick={() => setIsPayoutDialogOpen(true)}
                      >
                        {agent.payoutAddress
                          ? t("payoutAddressEdit")
                          : t("payoutAddressSet")}
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator />
              </>
            ) : null}

            {/* Tags */}
            <div className="flex gap-3">
              <Tags className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("tags")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {agent.tags && agent.tags.length > 0 ? (
                    agent.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {t("noTags")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {agentVerificationEnabled ? (
              <>
                <Separator />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("verification")}
                      </p>
                      <AgentVerificationOverviewLine agent={agent} />
                    </div>
                  </div>
                  {onViewVerificationTab ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={onViewVerificationTab}
                    >
                      {t("viewInVerificationTab")}
                    </Button>
                  ) : null}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        {shouldShowAgentX402Options(
          agent.supportedPaymentSources,
          agent.pricing as { pricingType?: string } | null,
        ) ? (
          <AgentX402Options sources={agent.supportedPaymentSources} />
        ) : null}

        <RequestVerificationDialog
          open={verificationDialogOpen}
          onOpenChange={(open) => {
            setVerificationDialogOpen(open);
            if (!open) onVerificationDialogClosed?.();
          }}
          agent={agent}
          kycStatus={kycStatus}
          onSuccess={onVerificationSuccess ?? (() => {})}
        />

        {requiresPayoutAddress ? (
          <AgentPayoutAddressDialog
            agent={agent}
            open={isPayoutDialogOpen}
            onOpenChange={setIsPayoutDialogOpen}
            onUpdated={(updatedAgent) => onAgentUpdated?.(updatedAgent)}
          />
        ) : null}

        {showEditButton ? (
          <EditAgentDialog
            agent={agent}
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            onUpdated={(updatedAgent) => onAgentUpdated?.(updatedAgent)}
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            {t("additionalDetails")}
          </span>
          <Separator className="flex-1" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {t("metadata")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">
                {t("createdAt")}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm font-medium cursor-default">
                    {formatRelativeDate(agent.createdAt)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{formatDate(agent.createdAt)}</TooltipContent>
              </Tooltip>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">
                {t("updatedAt")}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm font-medium cursor-default">
                    {formatRelativeDate(agent.updatedAt)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{formatDate(agent.updatedAt)}</TooltipContent>
              </Tooltip>
            </div>
          </CardContent>
        </Card>
      </div>

      {(() => {
        const isPendingRegistration =
          agent.registrationState === "RegistrationRequested" ||
          agent.registrationState === "RegistrationInitiated";
        const pendingOver2Min =
          isPendingRegistration &&
          now > 0 &&
          now - new Date(agent.updatedAt).getTime() > STUCK_PENDING_MS;
        const showDangerZone =
          pendingOver2Min ||
          agent.registrationState === "RegistrationConfirmed" ||
          agent.registrationState === "DeregistrationConfirmed" ||
          agent.registrationState === "RegistrationFailed" ||
          agent.registrationState === "DeregistrationFailed";
        const showDeregisterCard =
          canDeregisterAgent(agent.registrationState) &&
          Boolean(agent.agentIdentifier);
        const showDeleteCard =
          pendingOver2Min ||
          agent.registrationState === "DeregistrationConfirmed" ||
          agent.registrationState === "RegistrationFailed" ||
          agent.registrationState === "DeregistrationFailed" ||
          (agent.registrationState === "RegistrationConfirmed" &&
            !agent.agentIdentifier);
        if (!showDangerZone || (!showDeregisterCard && !showDeleteCard))
          return null;
        return (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <Separator className="flex-1" />
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                {t("dangerZone")}
              </span>
              <Separator className="flex-1" />
            </div>
            {showDeregisterCard && (
              <Card className="border-destructive/60 bg-destructive/5">
                <CardContent>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{t("deregister")}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {t("deregisterDescription")}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={onDeregisterClick}
                      className="gap-2 shrink-0 w-full sm:w-auto"
                    >
                      {t("deregister")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {showDeleteCard && (
              <Card className="border-destructive/60 bg-destructive/5">
                <CardContent>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{t("delete")}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {pendingOver2Min
                          ? t("deleteStuckDescription")
                          : t("deleteDescription")}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={onDeleteClick}
                      className="gap-2 shrink-0 w-full sm:w-auto"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("delete")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );
      })()}
    </div>
  );
}
