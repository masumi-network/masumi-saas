import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { DevelopersPageClient } from "./developers-page-client";
import { DevelopersPageSkeleton } from "./developers-page-skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Developers");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("metaDescription"),
  };
}

export default async function DevelopersPage() {
  const t = await getTranslations("Developers");

  return (
    <div className="space-y-8 min-w-0 animate-page-in">
      <div className="space-y-2">
        <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm leading-6">
          {t.rich("description", {
            apikey: (chunks) => (
              <Link
                href="/api-keys"
                className="text-foreground underline underline-offset-2 hover:text-primary"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>

      <Suspense fallback={<DevelopersPageSkeleton />}>
        <DevelopersPageClient />
      </Suspense>
    </div>
  );
}
