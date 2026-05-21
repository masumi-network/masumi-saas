import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AppPage } from "@/components/app-page";
import { PageHeader } from "@/components/page-header";

import { EarningsPageContent } from "./earnings-page-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.Earnings");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function EarningsPage() {
  const t = await getTranslations("App.Earnings");

  return (
    <AppPage>
      <PageHeader title={t("title")} description={t("description")} />
      <EarningsPageContent />
    </AppPage>
  );
}
