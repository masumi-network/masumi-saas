import prisma from "@masumi/database/client";
import { Bot, Clock, UserCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AppPage } from "@/components/app-page";
import { PageHeader } from "@/components/page-header";
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
  let verifiedUsers = 0;
  let totalAgents = 0;
  let pendingKyc = 0;
  let hasError = false;

  try {
    [totalUsers, verifiedUsers, totalAgents, pendingKyc] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { emailVerified: true } }),
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
    <AppPage>
      <PageHeader title={t("title")} description={t("description")} />

      {hasError ? (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-center">
              {t("errorLoadingStats")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            className="animate-list-item-in transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            style={{ animationDelay: "0ms" }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("totalUsers")}
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
                {totalUsers}
              </div>
            </CardContent>
          </Card>

          <Card
            className="animate-list-item-in transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            style={{ animationDelay: "50ms" }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("verifiedUsers")}
              </CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
                {verifiedUsers}
              </div>
            </CardContent>
          </Card>

          <Card
            className="animate-list-item-in transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            style={{ animationDelay: "100ms" }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("totalAgents")}
              </CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
                {totalAgents}
              </div>
            </CardContent>
          </Card>

          <Card
            className="animate-list-item-in transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            style={{ animationDelay: "150ms" }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("pendingKyc")}
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
                {pendingKyc}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AppPage>
  );
}
