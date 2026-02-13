"use client";

import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";

interface IntroStepProps {
  consentAccepted: boolean;
  onConsentChange: (accepted: boolean) => void;
  onStart: () => void;
  isLoading: boolean;
  kycStatus: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW";
  rejectionReason?: string | null;
}

export function IntroStep({
  consentAccepted,
  onConsentChange,
  onStart,
  isLoading,
  kycStatus,
  rejectionReason,
}: IntroStepProps) {
  const t = useTranslations("App.Verification.Intro");

  return (
    <div className="space-y-8">
      {kycStatus === "REJECTED" && rejectionReason && (
        <Alert variant="destructive">
          <AlertTitle>{t("rejectionTitle")}</AlertTitle>
          <AlertDescription>{rejectionReason}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        <div className="space-y-1.5">
          <h3 className="text-sm font-medium">{t("purposeTitle")}</h3>
          <p className="text-sm text-muted-foreground leading-6">
            {t("purpose")}
          </p>
        </div>

        <div className="space-y-1.5">
          <h3 className="text-sm font-medium">{t("gdprTitle")}</h3>
          <p className="text-sm text-muted-foreground leading-6">{t("gdpr")}</p>
        </div>

        <div className="space-y-1.5">
          <h3 className="text-sm font-medium">{t("biometricTitle")}</h3>
          <p className="text-sm text-muted-foreground leading-6">
            {t("biometric")}
          </p>
        </div>

        <div className="space-y-1.5">
          <h3 className="text-sm font-medium">{t("credentialTitle")}</h3>
          <p className="text-sm text-muted-foreground leading-6">
            {t("credential")}
          </p>
        </div>
      </div>

      <div className="flex items-start space-x-3 pt-4 border-t">
        <Checkbox
          id="consent"
          checked={consentAccepted}
          onCheckedChange={(checked) => onConsentChange(checked === true)}
          className="mt-0.5"
        />
        <label
          htmlFor="consent"
          className="text-sm leading-relaxed cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {t("consentLabel")}
        </label>
      </div>

      <Button
        onClick={onStart}
        disabled={!consentAccepted || isLoading}
        className="w-full"
      >
        {isLoading && <Spinner size={16} className="mr-2" />}
        {t("startButton")}
      </Button>
    </div>
  );
}
