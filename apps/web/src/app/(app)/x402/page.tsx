import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AppPage } from "@/components/app-page";
import { Spinner } from "@/components/ui/spinner";
import { X402PageHeader } from "@/components/x402/x402-page-header";
import { requireX402PageAccess } from "@/lib/auth/org-admin";

import { X402PageContent } from "./x402-page-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.X402");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function X402Page() {
  await requireX402PageAccess();

  return (
    <AppPage>
      <X402PageHeader />
      <Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        }
      >
        <X402PageContent />
      </Suspense>
    </AppPage>
  );
}
