import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AppPage } from "@/components/app-page";
import { PageHeader } from "@/components/page-header";
import { getAdminAuthContext } from "@/lib/auth/utils";

import { ActivityPageContent } from "./activity-page-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.Activity");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function ActivityPage() {
  const t = await getTranslations("App.Activity");
  const { isAdmin } = await getAdminAuthContext();

  return (
    <AppPage>
      <PageHeader title={t("title")} description={t("description")} />
      <ActivityPageContent linkAgentsInAdmin={isAdmin} />
    </AppPage>
  );
}
