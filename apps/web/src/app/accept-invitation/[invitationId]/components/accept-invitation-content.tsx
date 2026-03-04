"use client";

import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  acceptInvitationAction,
  type InvitationDetails,
  rejectInvitationAction,
} from "@/lib/actions/organization.action";

interface AcceptInvitationContentProps {
  invitationId: string;
  invitation: InvitationDetails;
}

export function AcceptInvitationContent({
  invitationId,
  invitation,
}: AcceptInvitationContentProps) {
  const t = useTranslations("App.Organizations.AcceptInvitation");
  const router = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  const isLoading = isAccepting || isDeclining;

  const handleAccept = async () => {
    setIsAccepting(true);
    const result = await acceptInvitationAction(invitationId);
    if (result.success) {
      router.push("/organizations");
    } else {
      toast.error(result.error ?? t("acceptError"));
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    const result = await rejectInvitationAction(invitationId);
    if (result.success) {
      router.push("/");
    } else {
      toast.error(result.error ?? t("declineError"));
      setIsDeclining(false);
    }
  };

  const expiryDate = new Date(invitation.expiresAt).toLocaleDateString(
    undefined,
    { year: "numeric", month: "long", day: "numeric" },
  );

  const roleName =
    invitation.role === "admin"
      ? "Admin"
      : invitation.role === "owner"
        ? "Owner"
        : "Member";

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Building2 className="h-7 w-7 text-muted-foreground" />
          </div>
        </div>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <CardDescription className="mt-1 space-y-1">
          <span className="block">
            {t("invitedToJoin")}{" "}
            <span className="font-semibold text-foreground">
              {invitation.organizationName}
            </span>{" "}
            {t("invitedAs", { role: roleName })}
          </span>
          {invitation.inviterEmail && (
            <span className="block text-xs">
              {t("invitedBy", { name: invitation.inviterEmail })}
            </span>
          )}
          <span className="block text-xs">
            {t("expires", { date: expiryDate })}
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent />

      <CardFooter className="flex flex-col gap-2">
        <Button
          variant="primary"
          className="w-full"
          onClick={handleAccept}
          disabled={isLoading}
        >
          {isAccepting && <Spinner size={16} className="mr-2" />}
          {t("accept")}
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={handleDecline}
          disabled={isLoading}
        >
          {isDeclining && <Spinner size={16} className="mr-2" />}
          {t("decline")}
        </Button>
      </CardFooter>
    </Card>
  );
}
