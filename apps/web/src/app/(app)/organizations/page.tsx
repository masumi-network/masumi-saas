import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getOrganizationsAction } from "@/lib/actions/organization.action";

import { CreateOrganizationDialog } from "./components/create-organization-dialog";
import { OrganizationsContent } from "./components/organizations-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.Organizations");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function OrganizationsPage() {
  const t = await getTranslations("App.Organizations");
  const result = await getOrganizationsAction();
  const organizations = result.success ? result.data : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm leading-6">
            {t("description")}
          </p>
        </div>
        <CreateOrganizationDialog />
      </div>
      <OrganizationsContent organizations={organizations} />
    </div>
  );
}
