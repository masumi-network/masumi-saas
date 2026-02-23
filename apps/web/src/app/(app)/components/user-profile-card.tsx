import gravatarUrl from "gravatar-url";
import { AlertCircle, Clock, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getKycStatusAction } from "@/lib/actions/kyc.action";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import {
  getKycStatusBadgeKey,
  getKycStatusBadgeVariant,
} from "@/lib/kyc-status";
import { getInitials } from "@/lib/utils/format-name";

export async function UserProfileCard() {
  const t = await getTranslations("App.Home.KycStatus");
  const tStatus = await getTranslations("App.Agents");

  const { user } = await getAuthenticatedOrThrow();
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
      title: string;
      description: string;
      action: string | null;
      actionHref: string | null;
    }
  > = {
    PENDING: {
      icon: AlertCircle,
      title: t("pending.title"),
      description: t("pending.description"),
      action: t("pending.action"),
      actionHref: "/verification",
    },
    REVIEW: {
      icon: Clock,
      title: t("review.title"),
      description: t("review.description"),
      action: null,
      actionHref: null,
    },
    APPROVED: {
      icon: ShieldCheck,
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
      title: t("rejected.title"),
      description: kycRejectionReason || t("rejected.description"),
      action: t("rejected.action"),
      actionHref: "/verification",
    },
  };

  const kycStatusInfo = statusConfig[kycStatus as KycStatus];

  const userImage =
    user.image ??
    gravatarUrl(user.email, {
      size: 100,
      default: "404",
    });
  const userName = user.name || user.email || "User";
  const userInitials = getInitials(userName);

  return (
    <Card className="max-w-3xl overflow-hidden pt-0">
      <CardHeader className="bg-masumi-gradient rounded-t-xl pt-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={userImage} alt={userName} />
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
          <div className="flex w-full gap-4 items-center justify-between">
            <div className="flex-1 space-y-1">
              <CardTitle className="text-base">{userName}</CardTitle>
              <CardDescription className="text-sm">
                {user.email}
              </CardDescription>
            </div>
            <Badge
              variant={getKycStatusBadgeVariant(kycStatus)}
              className="inline-flex items-center justify-center gap-1.5 h-6 w-6 shrink-0 p-0 sm:w-auto sm:h-auto sm:justify-start sm:px-2.5 sm:py-1"
            >
              <kycStatusInfo.icon className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">
                {tStatus(`status.${getKycStatusBadgeKey(kycStatus)}`)}
              </span>
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardFooter className="flex flex-col gap-6">
        <Separator />
        <CardDescription>{kycStatusInfo.description}</CardDescription>
        {kycStatusInfo.action && kycStatusInfo.actionHref && (
          <Button asChild variant="outline" className="w-full md:w-auto">
            <Link href={kycStatusInfo.actionHref}>{kycStatusInfo.action}</Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export function UserProfileCardSkeleton() {
  return (
    <Card className="max-w-3xl overflow-hidden pt-0">
      <CardHeader className="bg-masumi-gradient rounded-t-xl pt-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex w-full gap-4 items-center justify-between">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-6 w-6 rounded-full sm:w-24" />
          </div>
        </div>
      </CardHeader>
      <CardFooter className="flex flex-col gap-6">
        <Separator />
        <Skeleton className="h-4 w-full max-w-md" />
      </CardFooter>
    </Card>
  );
}
