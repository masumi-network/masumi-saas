import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AppPage } from "@/components/app-page";
import { PageHeader } from "@/components/page-header";
import { getApiKeysPageDataAction } from "@/lib/actions/org-api-keys.action";
import { getAuthContext } from "@/lib/auth/utils";

import { ApiKeysList } from "./components/api-keys-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.ApiKeys");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function ApiKeysPage() {
  const t = await getTranslations("App.ApiKeys");
  const authContext = await getAuthContext();

  if (!authContext.isAuthenticated) {
    redirect("/signin?callbackUrl=" + encodeURIComponent("/api-keys"));
  }

  const result = await getApiKeysPageDataAction();
  if (!result.success) {
    return (
      <AppPage>
        <PageHeader title={t("title")} description={t("description")} />
        <p className="text-destructive">{result.error}</p>
      </AppPage>
    );
  }

  return (
    <AppPage>
      <PageHeader title={t("title")} description={t("description")} />
      <ApiKeysList data={result.data} />
    </AppPage>
  );
}
