import { AlertCircle, Clock, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getKycStatusAction } from "@/lib/actions/kyc.action";

export async function KycStatusCard() {
  const t = await getTranslations("App.Home.KycStatus");

  const result = await getKycStatusAction();

  if (!result.success || !result.data) {
    return null;
  }

  const { kycStatus, kycCompletedAt, kycRejectionReason } = result.data;

  const statusConfig = {
    PENDING: {
      icon: AlertCircle,
      iconColor: "text-muted-foreground",
      title: t("pending.title"),
      description: t("pending.description"),
      action: t("pending.action"),
      actionHref: "/onboarding",
    },
    REVIEW: {
      icon: Clock,
      iconColor: "text-primary",
      title: t("review.title"),
      description: t("review.description"),
      action: null,
      actionHref: null,
    },
    APPROVED: {
      icon: ShieldCheck,
      iconColor: "text-green-500",
      title: t("approved.title"),
      description: kycCompletedAt
        ? t("approved.descriptionWithDate", {
            date: new Date(kycCompletedAt).toLocaleString(),
          })
        : t("approved.description"),
      action: null,
      actionHref: null,
    },
    REJECTED: {
      icon: XCircle,
      iconColor: "text-destructive",
      title: t("rejected.title"),
      description: kycRejectionReason || t("rejected.description"),
      action: t("rejected.action"),
      actionHref: "/onboarding",
    },
  };

  const config = statusConfig[kycStatus];
  const Icon = config.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Icon className={`h-5 w-5 ${config.iconColor}`} />
          <CardTitle>{config.title}</CardTitle>
        </div>
        <CardDescription>{config.description}</CardDescription>
      </CardHeader>
      {config.action && config.actionHref && (
        <CardFooter>
          <Button asChild variant="outline" className="w-full">
            <Link href={config.actionHref}>{config.action}</Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
