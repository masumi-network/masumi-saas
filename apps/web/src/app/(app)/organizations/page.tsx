import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AppPage } from "@/components/app-page";
import { PageHeader } from "@/components/page-header";
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
    <AppPage>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          organizations.length > 0 ? <CreateOrganizationDialog /> : undefined
        }
      />
      <OrganizationsContent organizations={organizations} />
    </AppPage>
  );
}
