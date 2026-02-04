import prisma from "@masumi/database/client";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getAuthContext } from "@/lib/auth/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.Home");
  return {
    title: `Masumi - ${t("welcome")}`,
    description: t("signedInAs", { email: "" }),
  };
}

export default async function HomePage() {
  const authContext = await getAuthContext();
  const t = await getTranslations("App.Home");

  if (authContext.session?.user) {
    const user = await prisma.user.findUnique({
      where: { id: authContext.session.user.id },
      select: {
        kycVerification: {
          select: {
            status: true,
          },
        },
      },
    });

    // Only redirect to onboarding if KYC hasn't been started (PENDING)
    // REVIEW and REJECTED statuses can access the dashboard
    const kycStatus = user?.kycVerification?.status || "PENDING";
    if (kycStatus === "PENDING") {
      redirect("/onboarding");
    }

    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-light tracking-tight">{t("welcome")}</h1>
        <p className="text-muted-foreground">
          {t("signedInAs", { email: authContext.session.user.email || "" })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-light tracking-tight">{t("welcome")}</h1>
      <p className="text-muted-foreground">
        {t("signedInAs", { email: authContext.session?.user?.email || "" })}
      </p>
    </div>
  );
}
