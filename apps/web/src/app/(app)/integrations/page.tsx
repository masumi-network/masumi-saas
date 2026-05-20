import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getAuthContext } from "@/lib/auth/utils";

import { IntegrationsPageContent } from "./components/integrations-page-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.Integrations");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function IntegrationsPage() {
  const t = await getTranslations("App.Integrations");
  const authContext = await getAuthContext();

  if (!authContext.isAuthenticated) {
    redirect("/signin?callbackUrl=" + encodeURIComponent("/integrations"));
  }

  return (
    <div className="space-y-8 animate-page-in">
      <div className="space-y-2">
        <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm leading-6">
          {t("description")}
        </p>
      </div>
      <IntegrationsPageContent />
    </div>
  );
}
