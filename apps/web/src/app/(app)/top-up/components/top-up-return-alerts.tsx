import { CheckCircle2, XCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { verifyTopUpReturnSession } from "@/lib/stripe/verify-return-session";

type TopUpReturnAlertsProps = {
  userId: string;
  sessionId?: string;
  canceled?: boolean;
};

export async function TopUpReturnAlerts({
  userId,
  sessionId,
  canceled,
}: TopUpReturnAlertsProps) {
  const t = await getTranslations("App.TopUp");

  if (canceled) {
    return (
      <Alert className="flex gap-3">
        <XCircle className="h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <AlertTitle>{t("cancelTitle")}</AlertTitle>
          <AlertDescription>{t("cancelDescription")}</AlertDescription>
        </div>
      </Alert>
    );
  }

  if (!sessionId) {
    return null;
  }

  const info = await verifyTopUpReturnSession({
    userId,
    sessionId,
  });

  if (!info.ok) {
    return null;
  }

  return (
    <Alert className="flex gap-3">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <AlertTitle>{t("successTitle")}</AlertTitle>
        <AlertDescription>
          {t("successDescription", { credits: info.credits })}
        </AlertDescription>
      </div>
    </Alert>
  );
}
