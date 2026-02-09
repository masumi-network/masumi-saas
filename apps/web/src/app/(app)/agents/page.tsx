import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AgentsContent } from "./components/agents-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.Agents");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default function AgentsPage() {
  return (
    <div className="w-full space-y-12">
      <AgentsContent />
    </div>
  );
}
