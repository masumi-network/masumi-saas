import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AppPage } from "@/components/app-page";
import { PageHeader } from "@/components/page-header";

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
    <AppPage className="min-w-0">
      <PageHeader
        title={t("title")}
        description={t.rich("description", {
          apikey: (chunks) => (
            <Link
              href="/api-keys"
              className="text-foreground underline underline-offset-2 hover:text-primary"
            >
              {chunks}
            </Link>
          ),
        })}
      />

      <Suspense fallback={<DevelopersPageSkeleton />}>
        <DevelopersPageClient />
      </Suspense>
    </AppPage>
  );
}
