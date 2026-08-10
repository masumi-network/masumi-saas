import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getKycStatusAction } from "@/lib/actions/kyc.action";
import { isKycVerificationEnabled } from "@/lib/config/verification.config";
import { buildNetworkKycReturnUrl } from "@/lib/network-registration";
import { resolveNetworkRegisterSession } from "@/lib/network-registration/session";

import { NetworkRegisterShell } from "../components/network-register-shell";
import { NetworkRegisterSwitchAccount } from "../components/network-register-switch-account";
import { NetworkRegisterVerifyView } from "../components/network-register-verify-view";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ draftId?: string }>;

function networkSiteRegisterUrl(): string {
  const base =
    process.env.NETWORK_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_NETWORK_SITE_URL?.trim() ||
    "http://localhost:3010";
  return new URL("/register", base).toString();
}

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

  const session = await resolveNetworkRegisterSession({
    draftId: trimmedDraftId,
    returnPath: verifyPath,
  });

  if (session.kind === "not_found") {
    redirect(networkSiteRegisterUrl());
  }

  if (session.kind === "sign_in_required") {
    redirect(`/signin?callbackUrl=${encodeURIComponent(verifyPath)}`);
  }

  if (session.kind === "wrong_account") {
    return (
      <NetworkRegisterShell>
        <NetworkRegisterSwitchAccount
          registrationEmail={session.registrationEmail}
          signedInEmail={session.signedInEmail}
          returnPath={session.returnPath}
          backToRegistrationUrl={networkSiteRegisterUrl()}
        />
      </NetworkRegisterShell>
    );
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
