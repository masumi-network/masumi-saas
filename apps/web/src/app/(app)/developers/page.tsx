import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Developers");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function DevelopersPage() {
  const t = await getTranslations("Developers");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("description")}</p>
      </div>

      <div className="rounded-lg border p-8 text-center">
        <p className="text-muted-foreground">{t("comingSoon")}</p>
      </div>
    </div>
  );
}
