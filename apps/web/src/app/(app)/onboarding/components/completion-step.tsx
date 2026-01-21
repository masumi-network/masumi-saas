"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

interface CompletionStepProps {
  verificationCompleted: boolean;
}

export function CompletionStep({ verificationCompleted }: CompletionStepProps) {
  const t = useTranslations("App.Onboarding.Completion");
  const router = useRouter();

  return (
    <div className="space-y-6 text-center">
      {verificationCompleted ? (
        <>
          <div className="flex justify-center">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">{t("successTitle")}</h3>
            <p className="text-muted-foreground mt-2">{t("successMessage")}</p>
          </div>
          <Button onClick={() => router.push("/")} className="w-full">
            {t("continueButton")}
          </Button>
        </>
      ) : (
        <>
          <div className="flex justify-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">{t("processingTitle")}</h3>
            <p className="text-muted-foreground mt-2">
              {t("processingMessage")}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
