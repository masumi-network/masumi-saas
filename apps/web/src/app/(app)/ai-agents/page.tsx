import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AppPage } from "@/components/app-page";
import { PageHeader } from "@/components/page-header";

import { AgentsContent } from "./components/agents-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.Agents");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function AgentsPage() {
  const t = await getTranslations("App.Agents");

  return (
    <AppPage>
      <PageHeader title={t("title")} description={t("description")} />
      <AgentsContent />
    </AppPage>
  );
}
