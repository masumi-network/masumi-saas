import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.ApiKeys");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function ApiKeysPage() {
  const t = await getTranslations("App.ApiKeys");

  // TODO: Implement full API keys page - list keys, create, revoke, toggle sidebar disabled when ready
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm leading-6">
          {t("description")}
        </p>
      </div>
    </div>
  );
}
