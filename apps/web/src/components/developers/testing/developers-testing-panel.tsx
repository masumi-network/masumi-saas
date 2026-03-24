"use client";

import { ArrowRightLeft, CreditCard, ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { TestPaymentDialog } from "@/components/developers/testing/test-payment-dialog";
import { usePaidAgentsForTesting } from "@/components/developers/testing/use-paid-agents-for-testing";
export function DevelopersTestingPanel() {
  const t = useTranslations("Developers.testing");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const { agents, isLoading, error } = usePaidAgentsForTesting();

  return (
    <>
      <div className="space-y-6 animate-fade-in-up opacity-0">
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="grid gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setPaymentOpen(true)}
            className="group border rounded-lg p-6 text-left transition-all duration-200 hover:shadow-md hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] animate-fade-in-up opacity-0"
            style={{ animationDelay: "0ms" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors duration-200">
                <CreditCard className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors duration-200" />
              </div>
              <h2 className="font-medium">{t("cards.testPayment.title")}</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("cards.testPayment.description")}
            </p>
          </button>

          <div
            className="border rounded-lg p-6 text-left opacity-40 cursor-not-allowed animate-fade-in-up"
            style={{ animationDelay: "75ms" }}
            role="group"
            aria-disabled="true"
            title={t("cards.comingSoon")}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </div>
              <h2 className="font-medium">{t("cards.testPurchase.title")}</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("cards.testPurchase.description")}
            </p>
            <p className="text-xs text-muted-foreground mt-3 font-medium">
              {t("cards.comingSoon")}
            </p>
          </div>

          <div
            className="border rounded-lg p-6 text-left opacity-40 cursor-not-allowed animate-fade-in-up"
            style={{ animationDelay: "150ms" }}
            role="group"
            aria-disabled="true"
            title={t("cards.comingSoon")}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted">
                <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
              </div>
              <h2 className="font-medium">{t("cards.fullCycle.title")}</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("cards.fullCycle.description")}
            </p>
            <p className="text-xs text-muted-foreground mt-3 font-medium">
              {t("cards.comingSoon")}
            </p>
          </div>
        </div>
      </div>

      <TestPaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        paidAgents={agents}
        isLoadingAgents={isLoading}
      />
    </>
  );
}
