import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getKycStatusAction } from "@/lib/actions/kyc.action";
import { getAuthContext } from "@/lib/auth/utils";
import { isKycVerificationEnabled } from "@/lib/config/verification.config";
import { buildNetworkKycReturnUrl } from "@/lib/network-registration";

import { NetworkRegisterVerifyView } from "../components/network-register-verify-view";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ draftId?: string }>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.NetworkRegister.verify");
  return {
    title: `Masumi Network - ${t("title")}`,
    description: t("description"),
  };
}

export default async function NetworkRegisterVerifyPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { draftId } = await searchParams;
  if (!draftId?.trim()) {
    redirect("/signin");
  }

  const trimmedDraftId = draftId.trim();
  const verifyPath = `/network-register/verify?draftId=${encodeURIComponent(trimmedDraftId)}`;

  const authContext = await getAuthContext();
  if (!authContext.isAuthenticated || !authContext.session) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(verifyPath)}`);
  }

  if (!isKycVerificationEnabled()) {
    redirect(buildNetworkKycReturnUrl(trimmedDraftId));
  }

  const result = await getKycStatusAction();
  const kycStatus = result.success
    ? (result.data?.kycStatus ?? "PENDING")
    : "PENDING";
  const rejectionReason = result.success
    ? (result.data?.kycRejectionReason ?? null)
    : null;

  if (kycStatus === "APPROVED") {
    redirect(buildNetworkKycReturnUrl(trimmedDraftId));
  }

  const t = await getTranslations("App.NetworkRegister.verify");

  return (
    <NetworkRegisterVerifyView
      draftId={trimmedDraftId}
      kycStatus={kycStatus}
      rejectionReason={rejectionReason}
      title={t("title")}
      description={t("description")}
    />
  );
}
