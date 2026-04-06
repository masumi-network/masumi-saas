import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { WithdrawalsPageContent } from "./withdrawals-page-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.Withdrawals");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

function WithdrawalsFallback() {
  return (
    <div className="space-y-8" aria-busy>
      <div className="bg-muted h-9 max-w-md animate-pulse rounded-md" />
      <div className="bg-muted h-48 w-full animate-pulse rounded-lg" />
    </div>
  );
}

export default async function WithdrawalsPage() {
  const t = await getTranslations("App.Withdrawals");

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm leading-6">
          {t("description")}
        </p>
      </div>
      <Suspense fallback={<WithdrawalsFallback />}>
        <WithdrawalsPageContent />
      </Suspense>
    </div>
  );
}
