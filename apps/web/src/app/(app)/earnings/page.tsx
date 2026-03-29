import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { EarningsPageContent } from "./earnings-page-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.Earnings");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

function EarningsPageFallback() {
  return (
    <div className="space-y-8" aria-busy>
      <div className="bg-muted h-9 max-w-md animate-pulse rounded-md" />
      <div className="bg-muted h-24 max-w-lg animate-pulse rounded-md" />
      <div className="bg-muted h-[min(22rem,55vh)] min-h-[240px] w-full animate-pulse rounded-lg" />
    </div>
  );
}

export default function EarningsPage() {
  return (
    <Suspense fallback={<EarningsPageFallback />}>
      <EarningsPageContent />
    </Suspense>
  );
}
