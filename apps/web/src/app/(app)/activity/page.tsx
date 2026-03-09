import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

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

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm leading-6">
          {t("description")}
        </p>
      </div>
      <ActivityPageContent />
    </div>
  );
}
