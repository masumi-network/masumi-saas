"use client";

import { AlertCircle, Clock, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getKycStatusAction } from "@/lib/actions";
import { type Agent } from "@/lib/api/agent.client";
import { cn } from "@/lib/utils";

import { RequestVerificationDialog } from "./request-verification-dialog";

interface AgentVerificationCardProps {
  agent: Agent;
  onVerificationSuccess: () => void;
}

export function AgentVerificationCard({
  agent,
  onVerificationSuccess,
}: AgentVerificationCardProps) {
  const t = useTranslations("App.Agents.Details.Verification");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [kycStatus, setKycStatus] = useState<
    "PENDING" | "APPROVED" | "REJECTED" | "REVIEW" | null
  >(null);
  const [isLoadingKyc, setIsLoadingKyc] = useState(true);
  const [, startTransition] = useTransition();

  const status = agent.verificationStatus || "PENDING";

  useEffect(() => {
    startTransition(async () => {
      const result = await getKycStatusAction();
      if (result.success && result.data) {
        setKycStatus(result.data.kycStatus);
      }
      setIsLoadingKyc(false);
    });
  }, []);

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

  const config =
    statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
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
      {config.showButton && (
        <CardFooter>
          {isLoadingKyc ? (
            <Button variant="primary" className="w-full" disabled>
              {t("loading")}
            </Button>
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
      )}

      <RequestVerificationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agent={agent}
        kycStatus={kycStatus}
        onSuccess={onVerificationSuccess}
      />
    </Card>
  );
}
