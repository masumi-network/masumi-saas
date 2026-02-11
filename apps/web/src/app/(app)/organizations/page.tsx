import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.Organizations");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function OrganizationsPage() {
  const t = await getTranslations("App.Organizations");

  // TODO: Re-add CreateOrganizationDialog and OrganizationsContent so users can view and create organizations
  return (
    <div className="space-y-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm leading-6">
          {t("description")}
        </p>
      </div>
    </div>
  );
}
