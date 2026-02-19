import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.Analytics");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function AnalyticsPage() {
  const t = await getTranslations("App.Analytics");

  // TODO: Implement analytics - revenue charts, usage, agent breakdown
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm leading-6">
          {t("description")}
        </p>
      </div>
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-muted-foreground text-sm">{t("comingSoon")}</p>
      </div>
    </div>
  );
}
