import { Clock3, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AppPage } from "@/components/app-page";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.Withdraw");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function WithdrawPage() {
  const t = await getTranslations("App.Withdraw");

  return (
    <AppPage>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Badge variant="outline-muted" className="shrink-0">
            <Clock3 className="mr-1 h-3 w-3" />
            {t("status")}
          </Badge>
        }
      />

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 fill-mode-both delay-0">
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted-surface/60 px-4 py-16">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Wallet className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-center text-sm font-medium text-foreground">
            {t("comingSoon")}
          </p>
          <p className="mt-1 max-w-sm text-center text-xs text-muted-foreground">
            {t("description")}
          </p>
        </div>
      </div>
    </AppPage>
  );
}
