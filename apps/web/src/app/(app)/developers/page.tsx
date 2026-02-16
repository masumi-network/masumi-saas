import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { InputSchemaValidator } from "@/components/developers/InputSchemaValidator";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.Developers");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function DevelopersPage() {
  const t = await getTranslations("App.Developers");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm leading-6">
          {t("description")}
        </p>
      </div>
      <InputSchemaValidator />
    </div>
  );
}
