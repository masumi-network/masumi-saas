import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { getDashboardOverviewAction } from "@/lib/actions/dashboard.action";
import { getAuthContext } from "@/lib/auth/utils";

import DashboardOverview, {
  DashboardOverviewSkeleton,
} from "./components/dashboard/dashboard-overview";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.Home");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default function HomePage() {
  return (
    <Suspense fallback={<DashboardOverviewSkeleton />}>
      <HomePageContent />
    </Suspense>
  );
}

async function HomePageContent() {
  const authContext = await getAuthContext();
  const t = await getTranslations("App.Home");

  if (!authContext.isAuthenticated || !authContext.session?.user) {
    return (
      <div className="space-y-12">
        <div className="space-y-2">
          <h1 className="text-2xl font-light tracking-tight">{t("welcome")}</h1>
          <p className="text-muted-foreground text-sm leading-6">
            {t("description")}
          </p>
        </div>
      </div>
    );
  }

  const result = await getDashboardOverviewAction();

  if (!result.success) {
    return (
      <div className="space-y-12">
        <div className="space-y-2">
          <h1 className="text-2xl font-light tracking-tight">{t("welcome")}</h1>
          <p className="text-muted-foreground text-sm leading-6">
            {t("description")}
          </p>
        </div>
        <p className="text-destructive">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-12">
      <DashboardOverview data={result.data} />
    </div>
  );
}
