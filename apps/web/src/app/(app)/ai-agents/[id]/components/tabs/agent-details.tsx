"use client";

import {
  DollarSign,
  ExternalLink,
  FileText,
  Fingerprint,
  Link2,
  ShieldCheck,
  Tag,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useTransition } from "react";

import { HtmlContent } from "@/components/html-content";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getKycStatusAction } from "@/lib/actions";
import { type Agent } from "@/lib/api/agent.client";
import { appConfig } from "@/lib/config/app.config";
import {
  formatDate,
  formatPricingDisplay,
  formatRelativeDate,
} from "@/lib/utils";

import { RequestVerificationDialog } from "../../../components/request-verification-dialog";

interface AgentDetailsProps {
  agent: Agent;
  onDeleteClick: () => void;
  onDeregisterClick: () => void;
  onVerificationSuccess?: () => void;
}

const STUCK_PENDING_MS = 2 * 60 * 1000;

export function AgentDetails({
  agent,
  onDeleteClick,
  onDeregisterClick,
  onVerificationSuccess,
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
  const tVerification = useTranslations("App.Agents.Details.Verification");
  const [kycStatus, setKycStatus] = useState<
    "PENDING" | "APPROVED" | "REJECTED" | "REVIEW" | null
  >(null);
  const [isLoadingKyc, setIsLoadingKyc] = useState(true);
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [, startTransition] = useTransition();

  const isVerified = agent.verificationStatus === "VERIFIED";
  const isRegistrationConfirmed =
    agent.registrationState === "RegistrationConfirmed";
  const showVerificationCta = !isVerified && isRegistrationConfirmed;

  const [isVerificationBannerDismissed, setIsVerificationBannerDismissed] =
    useState(true);

  useEffect(() => {
    const key = `dismissedAgentVerification_${agent.id}`;
    const dismissed =
      typeof window !== "undefined" && localStorage.getItem(key) === "1";
    const id = requestAnimationFrame(() =>
      setIsVerificationBannerDismissed(dismissed),
    );
    return () => cancelAnimationFrame(id);
  }, [agent.id]);

  const handleDismissVerificationBanner = useCallback(() => {
    const key = `dismissedAgentVerification_${agent.id}`;
    localStorage.setItem(key, "1");
    setIsVerificationBannerDismissed(true);
  }, [agent.id]);

  useEffect(() => {
    startTransition(async () => {
      const result = await getKycStatusAction();
      if (result.success && result.data) {
        setKycStatus(result.data.kycStatus);
      }
      setIsLoadingKyc(false);
    });
  }, []);

  const sokosumiUrl = `${appConfig.sokosumiMarketplaceUrl}/${agent.agentIdentifier ?? agent.id}`;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      {showVerificationCta &&
        onVerificationSuccess &&
        !isVerificationBannerDismissed && (
          <div className="relative flex flex-col md:flex-row items-center justify-between gap-4 rounded-md border border-amber-500/20 bg-amber-500/5 p-6 pr-10">
            <p className="text-sm text-muted-foreground">
              {t("verificationPromptDescription")}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              {isLoadingKyc ? (
                <Spinner size={16} className="shrink-0" />
              ) : kycStatus === "APPROVED" ? (
                <Button
                  variant="outline"
                  size="sm2"
                  onClick={() => setVerificationDialogOpen(true)}
                >
                  {tVerification("requestVerification")}
                </Button>
              ) : (
                <Button variant="outline" size="sm2" asChild>
                  <Link href="/verification">
                    {tVerification("completeKyc")}
                  </Link>
                </Button>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-5 w-5 shrink-0"
              onClick={handleDismissVerificationBanner}
              aria-label="Dismiss"
            >
              <X className="h-2.5 w-2.5" />
            </Button>
          </div>
        )}

      <div className="flex flex-col gap-2">
        <Card className="overflow-hidden gap-0 py-0">
          <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border/50 bg-masumi-gradient rounded-t-xl pt-6 p-6">
            <CardTitle className="text-base font-semibold">
              {t("overview")}
            </CardTitle>
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

            {/* Extended Description */}
            {agent.extendedDescription && (
              <>
                <div className="flex gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t("extendedDescription")}
                    </p>
                    {/<[a-z][\s\S]*>/i.test(agent.extendedDescription) ? (
                      <HtmlContent
                        html={agent.extendedDescription}
                        className="text-sm"
                      />
                    ) : (
                      <Markdown className="text-sm">
                        {agent.extendedDescription}
                      </Markdown>
                    )}
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

            {isRegistrationConfirmed && (
              <>
                <Separator />
                {/* Hire in Sokosumi */}
                <div className="flex gap-3 min-w-0">
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("hireInSokosumi")}
                    </p>
                    <div className="flex items-center gap-2 min-w-0">
                      <Link
                        href={sokosumiUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs sm:text-sm hover:underline truncate min-w-0"
                      >
                        {sokosumiUrl}
                      </Link>
                      <CopyButton
                        value={sokosumiUrl}
                        className="h-7 w-7 shrink-0"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Request verification CTA */}
            {showVerificationCta && onVerificationSuccess && (
              <>
                <Separator />
                <div className="flex gap-3 items-center justify-between">
                  <div className="flex gap-3 items-center min-w-0">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("verification")}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {isLoadingKyc ? (
                      <Button variant="primary" size="sm" disabled>
                        {tVerification("loading")}
                      </Button>
                    ) : kycStatus === "APPROVED" ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setVerificationDialogOpen(true)}
                      >
                        {tVerification("requestVerification")}
                      </Button>
                    ) : (
                      <Button variant="primary" size="sm" asChild>
                        <Link href="/verification">
                          {tVerification("completeKyc")}
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <RequestVerificationDialog
          open={verificationDialogOpen}
          onOpenChange={setVerificationDialogOpen}
          agent={agent}
          kycStatus={kycStatus}
          onSuccess={onVerificationSuccess ?? (() => {})}
        />
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
          now - new Date(agent.createdAt).getTime() > STUCK_PENDING_MS;
        const showDangerZone =
          pendingOver2Min ||
          agent.registrationState === "RegistrationConfirmed" ||
          agent.registrationState === "DeregistrationConfirmed" ||
          agent.registrationState === "RegistrationFailed" ||
          agent.registrationState === "DeregistrationFailed";
        const showDeregisterCard =
          agent.registrationState === "RegistrationConfirmed" &&
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
