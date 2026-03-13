import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import AdminAgentsContent from "./components/admin-agents-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.Agents");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function AdminAgentsPage() {
  const t = await getTranslations("Admin.Agents");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("description")}</p>
      </div>
      <AdminAgentsContent />
    </div>
  );
}
