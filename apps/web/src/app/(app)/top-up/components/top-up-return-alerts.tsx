"use client";

import { XCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Lightweight notice when the user aborted Stripe Checkout. Success returns
 * use `session_id`; that path verifies on the server and strips query params
 * client-side.
 */
export function TopUpCanceledBanner() {
  const t = useTranslations("App.TopUp");

  return (
    <Alert className="flex gap-3 border-muted-foreground/25 bg-muted/20">
      <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <AlertTitle>{t("cancelTitle")}</AlertTitle>
        <AlertDescription>{t("cancelDescription")}</AlertDescription>
      </div>
    </Alert>
  );
}
