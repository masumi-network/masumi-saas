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
import { getKycStatusAction } from "@/lib/actions/kyc.action";
import { getAuthContextWithHeaders } from "@/lib/auth/utils";
import {
  isKycVerificationEnabled,
  verificationFeatureCopy,
} from "@/lib/config/verification.config";

import { VerificationWizard } from "./components/verification-wizard";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.Verification.Intro");
  return {
    title: "Masumi - Identity Verification",
    description: t("purpose"),
  };
}

export default async function VerificationPage() {
  const { user, session } = await getAuthContextWithHeaders();

  if (!user || !session) {
    redirect("/signin");
  }

  if (!isKycVerificationEnabled()) {
    return (
      <div className="flex w-full max-w-2xl justify-center px-4 py-12">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{verificationFeatureCopy.kycUnavailableTitle}</CardTitle>
            <CardDescription>
              {verificationFeatureCopy.kycUnavailableDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/">
                {verificationFeatureCopy.returnToDashboardLabel}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const result = await getKycStatusAction();

  if (!result.success || !result.data) {
    redirect("/");
  }

  const { kycStatus, kycCompletedAt, kycRejectionReason } = result.data;

  if (kycStatus === "APPROVED") {
    redirect("/");
  }

  return (
    <div className="flex flex-col items-center justify-center w-full animate-page-in">
      <VerificationWizard
        kycStatus={kycStatus as "PENDING" | "APPROVED" | "REJECTED" | "REVIEW"}
        rejectionReason={kycRejectionReason}
        kycCompletedAt={kycCompletedAt}
      />
    </div>
  );
}
