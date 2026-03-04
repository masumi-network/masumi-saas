import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getInvitationAction } from "@/lib/actions/organization.action";
import { getAuthContext } from "@/lib/auth/utils";

import { AcceptInvitationContent } from "./components/accept-invitation-content";

export const metadata: Metadata = {
  title: "Masumi - Organization Invitation",
};

interface AcceptInvitationPageProps {
  params: Promise<{ invitationId: string }>;
}

export default async function AcceptInvitationPage({
  params,
}: AcceptInvitationPageProps) {
  const { invitationId } = await params;
  const t = await getTranslations("App.Organizations.AcceptInvitation");

  // Must be authenticated — invite links are sent to registered email addresses
  const authContext = await getAuthContext();
  if (!authContext.isAuthenticated) {
    redirect("/signin");
  }

  const result = await getInvitationAction(invitationId);

  // Invitation not found, expired, or already used
  if (!result.success || result.data.status !== "pending") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Building2 className="h-7 w-7 text-muted-foreground" />
            </div>
          </div>
          <CardTitle>{t("invalidTitle")}</CardTitle>
          <CardDescription>{t("invalidDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button variant="outline" asChild>
            <Link href="/">{t("backToHome")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <AcceptInvitationContent
      invitationId={invitationId}
      invitation={result.data}
    />
  );
}
