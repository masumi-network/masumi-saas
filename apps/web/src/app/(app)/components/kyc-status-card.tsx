import gravatarUrl from "gravatar-url";
import { AlertCircle, Clock, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getKycStatusAction } from "@/lib/actions/kyc.action";
import { getAuthenticatedHeaders } from "@/lib/auth/utils";
import { formatName } from "@/lib/utils";
import { getInitials } from "@/lib/utils/format-name";

export async function UserProfileCard() {
  const t = await getTranslations("App.Home.KycStatus");

  const { user } = await getAuthenticatedHeaders();
  const result = await getKycStatusAction();

  if (!result.success || !result.data) {
    return null;
  }

  const { kycStatus, kycCompletedAt, kycRejectionReason } = result.data;

  type KycStatus = "PENDING" | "REVIEW" | "APPROVED" | "REJECTED";

  const statusConfig: Record<
    KycStatus,
    {
      icon: typeof AlertCircle;
      iconColor: string;
      title: string;
      description: string;
      action: string | null;
      actionHref: string | null;
    }
  > = {
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

  const config = statusConfig[kycStatus as KycStatus];
  const Icon = config.icon;

  const userImage =
    user.image ??
    gravatarUrl(user.email, {
      size: 100,
      default: "404",
    });
  const userName = formatName(user.name) || user.email || "User";
  const userInitials = getInitials(userName);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={userImage} alt={userName} />
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1">
            <CardTitle className="text-base">{userName}</CardTitle>
            <CardDescription className="text-sm">{user.email}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${config.iconColor}`} />
            <span className="text-sm font-medium">{config.title}</span>
          </div>
        </div>
        <CardDescription className="mt-3">{config.description}</CardDescription>
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
