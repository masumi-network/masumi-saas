import { Clock3, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

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
    <div className="space-y-8 animate-page-in">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
          <Badge variant="outline-muted">
            <Clock3 className="mr-1 h-3 w-3" />
            {t("status")}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm leading-6">
          {t("description")}
        </p>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 fill-mode-both delay-0">
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted-surface/50 px-4 py-16">
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
    </div>
  );
}
