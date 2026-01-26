import { redirect } from "next/navigation";

import { getKycStatusAction } from "@/lib/actions/kyc.action";
import { getAuthContextWithHeaders } from "@/lib/auth/utils";

import { OnboardingWizard } from "./components/onboarding-wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
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
      <OnboardingWizard
        kycStatus={kycStatus as "PENDING" | "APPROVED" | "REJECTED" | "REVIEW"}
        rejectionReason={kycRejectionReason}
        kycCompletedAt={kycCompletedAt}
      />
    </div>
  );
}
