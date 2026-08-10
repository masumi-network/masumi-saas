"use client";

import { Lock, ScanFace } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";

interface NetworkRegisterIntroStepProps {
  consentAccepted: boolean;
  onConsentChange: (accepted: boolean) => void;
  onStart: () => void;
  isLoading: boolean;
  kycStatus: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW";
  rejectionReason?: string | null;
}

export function NetworkRegisterIntroStep({
  consentAccepted,
  onConsentChange,
  onStart,
  isLoading,
  kycStatus,
  rejectionReason,
}: NetworkRegisterIntroStepProps) {
  const t = useTranslations("App.NetworkRegister.verify");

  return (
    <div className="space-y-6">
      {kycStatus === "REJECTED" && rejectionReason ? (
        <Alert variant="destructive">
          <AlertTitle>{t("rejectedTitle")}</AlertTitle>
          <AlertDescription>{rejectionReason}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-4 text-sm text-muted-foreground">
        <div className="space-y-1.5">
          <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Lock className="h-4 w-4 text-primary" aria-hidden />
            {t("gdprTitle")}
          </h3>
          <p className="leading-6 pl-6">{t("gdpr")}</p>
        </div>
        <div className="space-y-1.5">
          <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ScanFace className="h-4 w-4 text-primary" aria-hidden />
            {t("biometricTitle")}
          </h3>
          <p className="leading-6 pl-6">{t("biometric")}</p>
        </div>
      </div>

      <div className="flex items-start space-x-3 border-t pt-4">
        <Checkbox
          id="network-register-kyc-consent"
          checked={consentAccepted}
          onCheckedChange={(checked) => onConsentChange(checked === true)}
          className="mt-0.5"
        />
        <label
          htmlFor="network-register-kyc-consent"
          className="cursor-pointer text-sm leading-relaxed"
        >
          {t("consentLabel")}
        </label>
      </div>

      <Button
        onClick={onStart}
        disabled={!consentAccepted || isLoading}
        className="w-full"
      >
        {isLoading ? <Spinner size={16} className="mr-2" /> : null}
        {t("startButton")}
      </Button>
    </div>
  );
}
