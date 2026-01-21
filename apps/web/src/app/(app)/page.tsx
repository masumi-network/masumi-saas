import prisma from "@masumi/database/client";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getAuthContext } from "@/lib/auth/utils";

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

    if (user?.kycStatus === "PENDING") {
      redirect("/onboarding");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("welcome")}</h1>
      <p className="text-muted-foreground">
        {t("signedInAs", { email: authContext.session?.user?.email || "" })}
      </p>
    </div>
  );
}
