import { Coins, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

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
import { serverLog } from "@/lib/server/logger";
import {
  getCreditUnitAmountCents,
  isStripeTopUpEnabled,
  STRIPE_CHECKOUT_CURRENCY,
} from "@/lib/stripe/config";
import { TOP_UP_PRESET_CREDIT_AMOUNTS } from "@/lib/stripe/top-up-constants";
import { verifyTopUpReturnSession } from "@/lib/stripe/verify-return-session";

import { TopUpPurchaseForm } from "./components/top-up-purchase-form";
import { TopUpCanceledBanner } from "./components/top-up-return-alerts";
import { TopUpReturnSuccessBanner } from "./components/top-up-return-success";
import { TopUpStripSessionQuery } from "./components/top-up-strip-session-query";

export async function generateMetadata(): Promise<Metadata> {
  if (!isStripeTopUpEnabled()) {
    notFound();
  }
  const t = await getTranslations("App.TopUp");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

function formatMinorUnitsForCheckout(
  cents: number,
  numberLocale: string,
): string {
  return new Intl.NumberFormat(numberLocale, {
    style: "currency",
    currency: STRIPE_CHECKOUT_CURRENCY.toUpperCase(),
  }).format(cents / 100);
}

type PageProps = {
  searchParams: Promise<{ session_id?: string; canceled?: string }>;
};

export default async function TopUpPage({ searchParams }: PageProps) {
  if (!isStripeTopUpEnabled()) {
    notFound();
  }

  const t = await getTranslations("App.TopUp");
  const numberLocale = await getLocale();
  const params = await searchParams;
  const sessionId = params.session_id;
  const canceledParam = params.canceled;
  const canceled = canceledParam === "1" || canceledParam === "true";

  const { user } = await getAuthenticatedOrThrow({
    requireEmailVerified: false,
  });

  /** Verified paid session from Stripe redirect (`?session_id=`); stripped next tick client-side. */
  let stripeReturnCreditsVerified: number | null = null;

  if (sessionId && !canceled) {
    const returnInfo = await verifyTopUpReturnSession({
      userId: user.id,
      sessionId,
    });
    if (returnInfo.ok) {
      stripeReturnCreditsVerified = returnInfo.credits;
    } else {
      serverLog.warn("Stripe top-up return session verification failed", {
        userId: user.id,
        sessionIdSuffix: sessionId.slice(-12),
        reason: returnInfo.reason,
      });
    }
  }

  const balance = await getCreditBalance(user.id);
  const formattedCredits = formatCreditAmount(balance.creditsRemaining);
  const unitCents = getCreditUnitAmountCents();
  const unitLabel =
    unitCents > 0
      ? t("unitLabel", {
          price: formatMinorUnitsForCheckout(unitCents, numberLocale),
        })
      : "";
  const purchaseTiers =
    unitCents > 0
      ? TOP_UP_PRESET_CREDIT_AMOUNTS.map((credits) => ({
          credits,
          totalFormatted: formatMinorUnitsForCheckout(
            credits * unitCents,
            numberLocale,
          ),
        }))
      : [];

  return (
    <div className="animate-page-in">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {t("description")}
          </p>
        </div>

        <div className="space-y-6">
          <Suspense fallback={null}>
            <TopUpStripSessionQuery />
          </Suspense>

          {canceled ? <TopUpCanceledBanner /> : null}

          {stripeReturnCreditsVerified !== null ? (
            <TopUpReturnSuccessBanner credits={stripeReturnCreditsVerified} />
          ) : null}

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 fill-mode-both delay-0">
            <Card className="gap-0 overflow-hidden pt-0">
              <CardHeader className="rounded-t-xl bg-masumi-gradient pb-4 pt-6">
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

              <CardContent className="space-y-4 pt-4">
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

                {unitCents > 0 ? (
                  <TopUpPurchaseForm
                    purchaseTiers={purchaseTiers}
                    stripeCheckoutCurrencyUpper={STRIPE_CHECKOUT_CURRENCY.toUpperCase()}
                    unitAmountCents={unitCents}
                    unitLabel={unitLabel}
                    numberLocale={numberLocale}
                  />
                ) : null}
              </CardContent>

              <CardFooter className="flex flex-col mt-6 items-start gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {t("webhookNote")}
                </p>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
