import { CheckCircle2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

type Props = {
  credits: number;
};

/** Shown once when `?session_id=` verifies; URL is stripped client-side on next navigation. */
export async function TopUpReturnSuccessBanner({ credits }: Props) {
  const t = await getTranslations("App.TopUp");

  return (
    <div className="flex gap-3 rounded-lg border border-primary/25 bg-muted/40 px-3 py-3 text-sm md:px-4">
      <CheckCircle2
        aria-hidden
        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
      />
      <div className="min-w-0 space-y-1">
        <p className="font-medium leading-tight text-foreground">
          {t("successTitle")}
        </p>
        <p className="leading-relaxed text-muted-foreground">
          {t("successDescription", { credits })}
        </p>
      </div>
    </div>
  );
}
