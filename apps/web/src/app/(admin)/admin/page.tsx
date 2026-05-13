import prisma from "@masumi/database/client";
import { Bot, Clock, UserCheck, Users } from "lucide-react";
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
    <div className="space-y-6 animate-page-in">
      <div className="space-y-2">
        <h1 className="text-3xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
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
        <div className="grid gap-4 md:grid-cols-4">
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
              <div className="text-2xl font-bold">{totalUsers}</div>
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
              <div className="text-2xl font-bold">{verifiedUsers}</div>
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
              <div className="text-2xl font-bold">{totalAgents}</div>
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
              <div className="text-2xl font-bold">{pendingKyc}</div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
