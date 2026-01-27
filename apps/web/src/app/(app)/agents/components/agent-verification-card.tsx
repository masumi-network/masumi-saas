"use client";

import { AlertCircle, Clock, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  getKycStatusAction,
  requestAgentVerificationAction,
} from "@/lib/actions";
import { cn } from "@/lib/utils";

type Agent = {
  id: string;
  name: string;
  description: string;
  apiUrl: string;
  tags: string[];
  verificationStatus: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW" | null;
  createdAt: Date;
  updatedAt: Date;
};

interface AgentVerificationCardProps {
  agent: Agent;
  onVerificationSuccess: () => void;
}

export function AgentVerificationCard({
  agent,
  onVerificationSuccess,
}: AgentVerificationCardProps) {
  const t = useTranslations("App.Agents.Details.Verification");
  const tStatus = useTranslations("App.Agents");
  const [isRequesting, setIsRequesting] = useState(false);
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
    REVIEW: {
      icon: Clock,
      iconColor: "text-primary",
      title: t("review.title"),
      description: t("review.description"),
      showButton: false,
    },
    APPROVED: {
      icon: ShieldCheck,
      iconColor: "text-green-500",
      title: t("approved.title"),
      description: t("approved.description"),
      showButton: false,
    },
    REJECTED: {
      icon: XCircle,
      iconColor: "text-destructive",
      title: t("rejected.title"),
      description: t("rejected.description"),
      showButton: true,
    },
  };

  const config =
    statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
  const Icon = config.icon;

  const handleRequestVerification = () => {
    setIsRequesting(true);
    startTransition(async () => {
      const result = await requestAgentVerificationAction(agent.id);
      if (result.success) {
        toast.success(t("requestSuccess"));
        onVerificationSuccess();
      } else {
        toast.error(result.error || t("requestError"));
      }
      setIsRequesting(false);
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-5 w-5", config.iconColor)} />
            <CardTitle className="text-sm font-medium">
              {config.title}
            </CardTitle>
          </div>
          <Badge
            variant={
              status === "APPROVED"
                ? "default"
                : status === "REJECTED"
                  ? "destructive"
                  : "secondary"
            }
            className={cn(
              status === "APPROVED" &&
                "bg-green-500 text-white hover:bg-green-500/80",
            )}
          >
            {status === "APPROVED"
              ? tStatus("status.approvedValue")
              : status === "REJECTED"
                ? tStatus("status.rejectedValue")
                : status === "REVIEW"
                  ? tStatus("status.reviewValue")
                  : tStatus("status.pendingValue")}
          </Badge>
        </div>
        <CardDescription className="mt-2">{config.description}</CardDescription>
      </CardHeader>
      {config.showButton && (
        <CardFooter>
          {!isLoadingKyc && (!kycStatus || kycStatus === "PENDING") ? (
            <Button variant="primary" className="w-full" asChild>
              <Link href="/onboarding">{t("completeKyc")}</Link>
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleRequestVerification}
              disabled={isRequesting}
              className="w-full"
            >
              {isRequesting && <Spinner size={16} className="mr-2" />}
              {t("requestVerification")}
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
