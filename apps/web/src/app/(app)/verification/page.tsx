import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AppPage } from "@/components/app-page";
import { getKycStatusAction } from "@/lib/actions/kyc.action";
import { getAuthContextWithHeaders } from "@/lib/auth/utils";
import { isKycVerificationEnabled } from "@/lib/config/verification.config";

import { VerificationWizard } from "./components/verification-wizard";

export const dynamic = "force-dynamic";

function resolveSafeReturnTo(returnTo: string | undefined): string | null {
  if (!returnTo?.trim()) return null;
  try {
    const appOrigin = new URL(
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
        process.env.BETTER_AUTH_URL?.trim() ||
        "http://localhost:2999",
    ).origin;
    const target = new URL(returnTo, appOrigin);
    if (target.origin === appOrigin) {
      return `${target.pathname}${target.search}${target.hash}`;
    }
  } catch {
    // ignore invalid returnTo
  }
  return null;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.Verification");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function VerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  const safeReturnTo = resolveSafeReturnTo(returnTo);

  const { user, session } = await getAuthContextWithHeaders();

  if (!user || !session) {
    const callbackPath = safeReturnTo
      ? `/verification?returnTo=${encodeURIComponent(safeReturnTo)}`
      : "/verification";
    redirect(`/signin?callbackUrl=${encodeURIComponent(callbackPath)}`);
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

  if (kycStatus === "APPROVED" && safeReturnTo) {
    redirect(safeReturnTo);
  }

  return (
    <AppPage className="mx-auto max-w-3xl">
      <VerificationWizard
        kycStatus={kycStatus}
        rejectionReason={rejectionReason}
        kycCompletedAt={kycCompletedAt}
        returnTo={safeReturnTo}
      />
    </AppPage>
  );
}
