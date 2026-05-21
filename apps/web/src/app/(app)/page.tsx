import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AppPage } from "@/components/app-page";
import { PageHeader } from "@/components/page-header";
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
      <AppPage animate={false}>
        <PageHeader title={t("welcome")} description={t("description")} />
      </AppPage>
    );
  }

  const cookieStore = await cookies();
  const networkCookie = cookieStore.get("payment_network")?.value;
  const network =
    networkCookie === "Mainnet" || networkCookie === "Preprod"
      ? networkCookie
      : undefined;
  const result = await getDashboardOverviewAction(network);

  if (!result.success) {
    return (
      <AppPage animate={false}>
        <PageHeader title={t("welcome")} description={t("description")} />
        <p className="text-destructive">{result.error}</p>
      </AppPage>
    );
  }

  return (
    <AppPage animate={false}>
      <DashboardOverview data={result.data} />
    </AppPage>
  );
}
