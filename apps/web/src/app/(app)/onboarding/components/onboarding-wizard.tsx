"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Steps } from "@/components/ui/steps";
import {
  generateKycAccessTokenAction,
  markKycAsSubmittedAction,
} from "@/lib/actions/kyc.action";

import { CompletionStep } from "./completion-step";
import { IntroStep } from "./intro-step";
import { SumsubStep } from "./sumsub-step";

interface OnboardingWizardProps {
  kycStatus: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW";
  rejectionReason?: string | null;
  kycCompletedAt?: Date | null;
}

export function OnboardingWizard({
  kycStatus,
  rejectionReason,
  kycCompletedAt,
}: OnboardingWizardProps) {
  const t = useTranslations("App.Onboarding");
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [verificationCompleted, setVerificationCompleted] = useState(false);

  const steps = [
    {
      title: t("steps.intro.title"),
      description: t("steps.intro.description"),
    },
    {
      title: t("steps.verification.title"),
      description: t("steps.verification.description"),
    },
    {
      title: t("steps.completion.title"),
      description: t("steps.completion.description"),
    },
  ];

  const handleStartVerification = async () => {
    if (!consentAccepted) {
      toast.error(t("errors.consentRequired"));
      return;
    }

    setIsLoadingToken(true);
    try {
      const result = await generateKycAccessTokenAction();
      if (result.success && result.data?.token) {
        setAccessToken(result.data.token);
        setCurrentStep(2);
      } else {
        toast.error(result.error || t("errors.tokenGenerationFailed"));
      }
    } catch {
      toast.error(t("errors.tokenGenerationFailed"));
    } finally {
      setIsLoadingToken(false);
    }
  };

  const handleVerificationComplete = async () => {
    // Mark KYC as submitted - webhook will save applicantId and update status
    await markKycAsSubmittedAction();
    setVerificationCompleted(true);
    setCurrentStep(3);
    setTimeout(() => {
      router.refresh();
    }, 2000);
  };

  const handleVerificationError = (error: string) => {
    toast.error(error || t("errors.verificationFailed"));
  };

  const isVerificationSubmitted =
    kycStatus === "REVIEW" || kycStatus === "REJECTED";

  return (
    <div className="w-full space-y-12 px-2">
      <div className="space-y-2">
        <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm leading-6">
          {t("description")}
        </p>
      </div>

      <div className="max-w-3xl space-y-8">
        {!isVerificationSubmitted && (
          <Steps currentStep={currentStep} steps={steps} />
        )}

        <Card>
          {isVerificationSubmitted ? (
            <>
              <CardHeader>
                <CardTitle>
                  {kycStatus === "REVIEW"
                    ? t("Completion.processingTitle")
                    : t("Intro.rejectionTitle")}
                </CardTitle>
                <CardDescription>
                  {kycStatus === "REVIEW"
                    ? t("Completion.processingMessage")
                    : rejectionReason || t("Completion.rejectedMessage")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CompletionStep
                  verificationCompleted={kycStatus === "REVIEW"}
                  kycStatus={kycStatus}
                  rejectionReason={rejectionReason}
                  kycCompletedAt={kycCompletedAt}
                />
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>{steps[currentStep - 1]?.title}</CardTitle>
                <CardDescription>
                  {steps[currentStep - 1]?.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {currentStep === 1 && (
                  <IntroStep
                    consentAccepted={consentAccepted}
                    onConsentChange={setConsentAccepted}
                    onStart={handleStartVerification}
                    isLoading={isLoadingToken}
                    kycStatus={kycStatus}
                    rejectionReason={rejectionReason}
                  />
                )}
                {currentStep === 2 && accessToken && (
                  <SumsubStep
                    accessToken={accessToken}
                    onComplete={handleVerificationComplete}
                    onError={handleVerificationError}
                    onManualContinue={handleVerificationComplete}
                  />
                )}
                {currentStep === 3 && (
                  <CompletionStep
                    verificationCompleted={verificationCompleted}
                    kycStatus={kycStatus}
                    rejectionReason={rejectionReason}
                    kycCompletedAt={kycCompletedAt}
                  />
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
