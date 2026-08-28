import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AppPage } from "@/components/app-page";
import { PageHeader } from "@/components/page-header";
import { getAuthContext } from "@/lib/auth/utils";

import { IntegrationsPageContent } from "./components/integrations-page-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.Integrations");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function IntegrationsPage() {
  const t = await getTranslations("App.Integrations");
  const authContext = await getAuthContext();

  if (!authContext.isAuthenticated) {
    redirect("/signin?callbackUrl=" + encodeURIComponent("/integrations"));
  }

  return (
    <AppPage>
      <PageHeader title={t("title")} description={t("description")} />
      <IntegrationsPageContent />
    </AppPage>
  );
}
