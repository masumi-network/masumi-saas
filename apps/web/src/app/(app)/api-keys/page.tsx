import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getApiKeysAction } from "@/lib/actions/auth.action";
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

  const result = await getApiKeysAction();
  if (!result.success) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm leading-6">
            {t("description")}
          </p>
        </div>
        <p className="text-destructive">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm leading-6">
          {t("description")}
        </p>
      </div>
      <ApiKeysList keys={result.keys} />
    </div>
  );
}
