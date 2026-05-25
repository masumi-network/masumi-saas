import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AppPage } from "@/components/app-page";

import { InboxAgentsPage } from "./components/inbox-agents-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.InboxAgents");
  return {
    title: `Masumi - ${t("metadataPageTitle")}`,
    description: t("metadataPageDescription"),
  };
}

export default function InboxAgentsRoute() {
  return (
    <AppPage className="w-full">
      <InboxAgentsPage />
    </AppPage>
  );
}
