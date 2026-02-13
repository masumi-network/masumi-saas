import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getKycStatusAction } from "@/lib/actions/kyc.action";
import { getAuthContextWithHeaders } from "@/lib/auth/utils";

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

  const result = await getKycStatusAction();

  if (!result.success || !result.data) {
    redirect("/");
  }

  const { kycStatus, kycCompletedAt, kycRejectionReason } = result.data;

  if (kycStatus === "APPROVED") {
    redirect("/");
  }

  return (
    <div>
      <VerificationWizard
        kycStatus={kycStatus as "PENDING" | "APPROVED" | "REJECTED" | "REVIEW"}
        rejectionReason={kycRejectionReason}
        kycCompletedAt={kycCompletedAt}
      />
    </div>
  );
}
