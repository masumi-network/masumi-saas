import prisma from "@masumi/database/client";
import { redirect } from "next/navigation";

import { getAuthContextWithHeaders } from "@/lib/auth/utils";

import { OnboardingWizard } from "./components/onboarding-wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { user, session } = await getAuthContextWithHeaders();

  if (!user || !session) {
    redirect("/signin");
  }

  const userWithKyc = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      kycStatus: true,
      kycCompletedAt: true,
      kycRejectionReason: true,
    },
  });

  if (userWithKyc?.kycStatus === "APPROVED") {
    redirect("/");
  }

  return (
    <div>
      <OnboardingWizard
        kycStatus={userWithKyc?.kycStatus || "PENDING"}
        rejectionReason={userWithKyc?.kycRejectionReason}
      />
    </div>
  );
}
