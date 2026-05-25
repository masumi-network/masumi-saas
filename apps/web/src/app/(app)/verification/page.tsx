import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AppPage } from "@/components/app-page";
import { getKycStatusAction } from "@/lib/actions/kyc.action";
import { getAuthContextWithHeaders } from "@/lib/auth/utils";
import { isKycVerificationEnabled } from "@/lib/config/verification.config";

import { VerificationWizard } from "./components/verification-wizard";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.Verification");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function VerificationPage() {
  const { user, session } = await getAuthContextWithHeaders();

  if (!user || !session) {
    redirect("/signin");
  }

  if (!isKycVerificationEnabled()) {
    redirect("/");
  }

  const result = await getKycStatusAction();
  const kycStatus = result.success
    ? (result.data?.kycStatus ?? "PENDING")
    : "PENDING";
  const rejectionReason = result.success
    ? (result.data?.kycRejectionReason ?? null)
    : null;
  const kycCompletedAt = result.success
    ? (result.data?.kycCompletedAt ?? null)
    : null;

  return (
    <AppPage className="mx-auto max-w-3xl">
      <VerificationWizard
        kycStatus={kycStatus}
        rejectionReason={rejectionReason}
        kycCompletedAt={kycCompletedAt}
      />
    </AppPage>
  );
}
