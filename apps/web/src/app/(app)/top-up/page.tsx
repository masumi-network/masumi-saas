import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.TopUp");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function TopUpPage() {
  const t = await getTranslations("App.TopUp");

  // TODO: Implement top-up flow - payment provider integration, amount selection, confirmation
  return (
    <div className="space-y-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm leading-6">
          {t("description")}
        </p>
      </div>
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-muted-foreground text-sm">{t("comingSoon")}</p>
      </div>
    </div>
  );
}
