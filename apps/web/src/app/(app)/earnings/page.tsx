import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

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
    <div className="space-y-8 animate-page-in">
      <div className="space-y-2">
        <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm leading-6">
          {t("description")}
        </p>
      </div>
      <EarningsPageContent />
    </div>
  );
}
