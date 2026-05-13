import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

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
    <div className="w-full space-y-8 animate-page-in">
      <InboxAgentsPage />
    </div>
  );
}
