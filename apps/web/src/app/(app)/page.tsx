import prisma from "@masumi/database/client";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getAuthContext } from "@/lib/auth/utils";

import { KycStatusCard } from "./components/kyc-status-card";

export default async function HomePage() {
  const authContext = await getAuthContext();
  const t = await getTranslations("App.Home");

  if (authContext.session?.user) {
    const user = await prisma.user.findUnique({
      where: { id: authContext.session.user.id },
      select: {
        kycStatus: true,
      },
    });

    // Only redirect to onboarding if KYC hasn't been started (PENDING)
    // REVIEW and REJECTED statuses can access the dashboard
    if (user?.kycStatus === "PENDING") {
      redirect("/onboarding");
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-light tracking-tight">{t("welcome")}</h1>
          <p className="text-muted-foreground">
            {t("signedInAs", { email: authContext.session.user.email || "" })}
          </p>
        </div>
        <KycStatusCard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-light tracking-tight">{t("welcome")}</h1>
      <p className="text-muted-foreground">
        {t("signedInAs", { email: authContext.session?.user?.email || "" })}
      </p>
    </div>
  );
}
