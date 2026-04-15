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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.TopUp");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function TopUpPage() {
  const t = await getTranslations("App.TopUp");
  const { user } = await getAuthenticatedOrThrow({
    requireEmailVerified: false,
  });
  const balance = await getCreditBalance(user.id);
  const formattedCredits = formatCreditAmount(balance.creditsRemaining);

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
            {t("status")}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm leading-6">
          {t("description")}
        </p>
      </div>

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
              </CardContent>

              <CardFooter className="flex flex-col items-start gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
                <Button disabled className="w-full sm:w-auto">
                  <PlusCircle className="h-4 w-4" />
                  {t("cta")}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {t("comingSoon")}
                </p>
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
