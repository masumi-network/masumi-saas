"use client";

import {
  DollarSign,
  ExternalLink,
  FileText,
  Fingerprint,
  Link2,
  ShieldCheck,
  Tags,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Separator } from "@/components/ui/separator";
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

import {
  getRegistrationStatusBadgeVariant,
  getRegistrationStatusKey,
} from "../../../components/agent-utils";
import { RequestVerificationDialog } from "../../../components/request-verification-dialog";

interface AgentDetailsProps {
  agent: Agent;
  onDeleteClick: () => void;
  onVerificationSuccess?: () => void;
}

export function AgentDetails({
  agent,
  onDeleteClick,
  onVerificationSuccess,
}: AgentDetailsProps) {
  const t = useTranslations("App.Agents.Details");
  const tVerification = useTranslations("App.Agents.Details.Verification");
  const tRegistrationStatus = useTranslations("App.Agents.registrationStatus");
  const [kycStatus, setKycStatus] = useState<
    "PENDING" | "APPROVED" | "REJECTED" | "REVIEW" | null
  >(null);
  const [isLoadingKyc, setIsLoadingKyc] = useState(true);
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [, startTransition] = useTransition();

  const isVerified = agent.verificationStatus === "VERIFIED";
  const showVerificationCta = !isVerified;

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
      <div className="flex flex-col gap-2">
        <Card className="overflow-hidden gap-0 py-0">
          <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border/50 bg-masumi-gradient rounded-t-xl pt-6 p-6">
            <CardTitle className="text-base font-semibold">
              {t("overview")}
            </CardTitle>
            <Badge
              variant={getRegistrationStatusBadgeVariant(
                agent.registrationState,
              )}
              className="w-fit min-w-fit shrink-0 ml-auto"
            >
              {tRegistrationStatus(
                getRegistrationStatusKey(agent.registrationState),
              )}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            {/* Description */}
            <div className="flex gap-3">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  {t("description")}
                </p>
                <p
                  className={
                    agent.description
                      ? "text-sm text-muted-foreground"
                      : "text-sm text-muted-foreground italic"
                  }
                >
                  {agent.description || t("noDescription")}
                </p>
              </div>
            </div>

            <Separator />

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
                  <span className="font-mono text-xs sm:text-sm truncate min-w-0">
                    {agent.agentIdentifier ?? agent.id}
                  </span>
                  <CopyButton
                    value={agent.agentIdentifier ?? agent.id}
                    className="h-7 w-7 shrink-0"
                  />
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

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            {t("dangerZone")}
          </span>
          <Separator className="flex-1" />
        </div>
        <Card className="border-destructive/60 bg-destructive/5">
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-2">
              <div className="min-w-0">
                <p className="font-medium text-sm">{t("delete")}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t("deleteDescription")}
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
      </div>
    </div>
  );
}
