import { XCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Lightweight notice when the user aborted Stripe Checkout. Success returns
 * use `session_id`; that path only strips query params server-side verification
 * still runs from the page loader.
 */
export async function TopUpCanceledBanner() {
  const t = await getTranslations("App.TopUp");

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
