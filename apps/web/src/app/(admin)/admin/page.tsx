import prisma from "@masumi/database/client";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminAuthContext } from "@/lib/auth/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.Dashboard");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function AdminDashboardPage() {
  // Defense-in-depth: verify admin even though layout also checks
  const authContext = await getAdminAuthContext();
  if (!authContext.isAuthenticated || !authContext.isAdmin) {
    redirect("/admin/signin");
  }

  const t = await getTranslations("Admin.Dashboard");

  // Fetch stats with error handling
  let totalUsers = 0;
  let totalAgents = 0;
  let pendingKyc = 0;
  let hasError = false;

  try {
    [totalUsers, totalAgents, pendingKyc] = await Promise.all([
      prisma.user.count(),
      prisma.agent.count(),
      prisma.kycVerification.count({
        where: { status: "PENDING" },
      }),
    ]);
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    hasError = true;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("description")}</p>
      </div>

      {hasError ? (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-center">
              {t("errorLoadingStats")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("totalUsers")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("totalAgents")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAgents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("pendingKyc")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingKyc}</div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
