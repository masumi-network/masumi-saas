import { AlertCircle, CheckCircle2, Coins, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
  getStripeTopUpConfigurationGaps,
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
  const configGaps = getStripeTopUpConfigurationGaps();
  const unitCents = getCreditUnitAmountCents();
  const unitLabel =
    topUpEnabled && unitCents > 0
      ? t("unitLabel", { price: formatMinorUnitsAsUsd(unitCents) })
      : "";

  return (
    <div className="space-y-8 animate-page-in">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
          <Badge variant="outline-muted">
            {topUpEnabled ? (
              <>
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {t("statusReady")}
              </>
            ) : (
              <>
                <AlertCircle className="mr-1 h-3 w-3" />
                {t("statusSetupRequired")}
              </>
            )}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm leading-6">
          {topUpEnabled ? t("description") : t("descriptionMisconfigured")}
        </p>
      </div>

      <TopUpReturnAlerts sessionId={sessionId} canceled={canceled} />

      <div className="grid gap-6 lg:max-w-3xl">
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

                {!topUpEnabled ? (
                  <Alert>
                    <AlertTitle>{t("misconfiguredTitle")}</AlertTitle>
                    <AlertDescription>
                      <p className="mb-2">{t("misconfiguredDescription")}</p>
                      <ul className="list-inside list-disc space-y-1 font-mono text-xs text-muted-foreground">
                        {configGaps.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                ) : null}

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
                {topUpEnabled ? (
                  <p className="text-xs text-muted-foreground">
                    {t("webhookNote")}
                  </p>
                ) : null}
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
