import {
  Bell,
  Clock3,
  Coins,
  CreditCard,
  History,
  PlusCircle,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuthenticatedOrThrow } from "@/lib/auth/utils";
import { formatCreditAmount } from "@/lib/credits/format";
import { getCreditBalance } from "@/lib/credits/service";
import {
  getCreditUnitAmountCents,
  isStripeTopUpEnabled,
} from "@/lib/stripe/config";

import { TopUpPurchaseForm } from "./components/top-up-purchase-form";
import { TopUpReturnAlerts } from "./components/top-up-return-alerts";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.TopUp");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

function formatMinorUnitsAsUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

type PageProps = {
  searchParams: Promise<{ session_id?: string; canceled?: string }>;
};

export default async function TopUpPage({ searchParams }: PageProps) {
  const t = await getTranslations("App.TopUp");
  const params = await searchParams;
  const sessionIdRaw = params.session_id;
  const sessionId = Array.isArray(sessionIdRaw)
    ? sessionIdRaw[0]
    : sessionIdRaw;
  const canceledRaw = params.canceled;
  const canceledParam = Array.isArray(canceledRaw)
    ? canceledRaw[0]
    : canceledRaw;
  const canceled = canceledParam === "1" || canceledParam === "true";

  const { user } = await getAuthenticatedOrThrow({
    requireEmailVerified: false,
  });
  const balance = await getCreditBalance(user.id);
  const formattedCredits = formatCreditAmount(balance.creditsRemaining);
  const topUpEnabled = isStripeTopUpEnabled();
  const unitCents = getCreditUnitAmountCents();
  const unitLabel =
    topUpEnabled && unitCents > 0
      ? t("unitLabel", { price: formatMinorUnitsAsUsd(unitCents) })
      : "";

  const roadmapItems = [
    { icon: CreditCard, label: t("roadmapBilling") },
    { icon: History, label: t("roadmapHistory") },
    { icon: Bell, label: t("roadmapAlerts") },
  ];

  return (
    <div className="space-y-8 animate-page-in">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
          <Badge variant="outline-muted">
            <Clock3 className="mr-1 h-3 w-3" />
            {topUpEnabled ? t("statusReady") : t("status")}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm leading-6">
          {t("description")}
        </p>
      </div>

      <TopUpReturnAlerts sessionId={sessionId} canceled={canceled} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <div className="space-y-6">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 fill-mode-both delay-0">
            <Card className="overflow-hidden pt-0">
              <CardHeader className="rounded-t-xl bg-masumi-gradient pb-6 pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <CardDescription className="text-foreground/70">
                      {t("balanceLabel")}
                    </CardDescription>
                    <CardTitle className="font-mono text-5xl font-semibold tracking-tight">
                      {formattedCredits}
                    </CardTitle>
                  </div>
                  <div className="rounded-full border border-foreground/10 bg-background/70 p-3 backdrop-blur-sm">
                    <Coins className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-6">
                <p className="text-sm leading-6 text-muted-foreground">
                  {t("balanceDescription")}
                </p>

                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {t("mainnetOnlyTitle")}
                      </p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {t("mainnetOnlyDescription")}
                      </p>
                    </div>
                  </div>
                </div>

                {topUpEnabled && unitCents > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      {t("purchaseTitle")}
                    </p>
                    <TopUpPurchaseForm unitLabel={unitLabel} />
                    <p className="text-xs text-muted-foreground">
                      {t("purchaseFootnote")}
                    </p>
                  </div>
                ) : null}
              </CardContent>

              <CardFooter className="flex flex-col items-start gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
                {!topUpEnabled ? (
                  <>
                    <Button disabled className="w-full sm:w-auto">
                      <PlusCircle className="h-4 w-4" />
                      {t("cta")}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {t("comingSoon")}
                    </p>
                  </>
                ) : null}
                {topUpEnabled ? (
                  <p className="text-xs text-muted-foreground">
                    {t("webhookNote")}
                  </p>
                ) : null}
              </CardFooter>
            </Card>
          </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 fill-mode-both delay-75">
          <Card className="h-full shadow-none">
            <CardHeader>
              <div className="space-y-2">
                <CardTitle className="text-base">{t("roadmapTitle")}</CardTitle>
                <CardDescription className="leading-6">
                  {t("roadmapDescription")}
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {roadmapItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-lg border bg-muted/20 p-4"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">{item.label}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
