"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
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
  getKycStatusAction,
  markKycAsSubmittedAction,
} from "@/lib/actions";

import { CompletionStep } from "./completion-step";
import { IntroStep } from "./intro-step";
import { SumsubStep } from "./sumsub-step";

const KYC_POLL_INTERVAL_MS = 4000;
const KYC_MAX_POLL_ATTEMPTS = 120;

interface VerificationWizardProps {
  kycStatus: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW";
  rejectionReason?: string | null;
  kycCompletedAt?: Date | null;
}

export function VerificationWizard({
  kycStatus,
  rejectionReason,
  kycCompletedAt,
}: VerificationWizardProps) {
  const t = useTranslations("App.Verification");
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(() =>
    kycStatus === "APPROVED" ? 3 : 1,
  );
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [verificationCompleted, setVerificationCompleted] = useState(false);
  const [liveKycStatus, setLiveKycStatus] = useState(kycStatus);
  const [liveRejectionReason, setLiveRejectionReason] = useState(
    rejectionReason ?? null,
  );
  const [liveKycCompletedAt, setLiveKycCompletedAt] = useState(
    kycCompletedAt ?? null,
  );
  const pollAttemptsRef = useRef(0);

  useEffect(() => {
    setLiveKycStatus(kycStatus);
    setLiveRejectionReason(rejectionReason ?? null);
    setLiveKycCompletedAt(kycCompletedAt ?? null);
  }, [kycStatus, rejectionReason, kycCompletedAt]);

  useEffect(() => {
    if (liveKycStatus === "APPROVED") {
      setCurrentStep(3);
    }
  }, [liveKycStatus]);

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
    const marked = await markKycAsSubmittedAction();
    if (!marked.success) {
      toast.error(marked.error || t("errors.verificationFailed"));
      return;
    }

    const refreshed = await getKycStatusAction();
    if (refreshed.success && refreshed.data) {
      setLiveKycStatus(refreshed.data.kycStatus);
      setLiveRejectionReason(refreshed.data.kycRejectionReason ?? null);
      setLiveKycCompletedAt(refreshed.data.kycCompletedAt ?? null);
    }

    setVerificationCompleted(true);
    setCurrentStep(3);
    router.refresh();
  };

  const handleVerificationError = (error: string) => {
    toast.error(error || t("errors.verificationFailed"));
  };

  const isVerificationSubmitted =
    liveKycStatus === "REVIEW" || liveKycStatus === "REJECTED";

  useEffect(() => {
    const shouldPoll =
      liveKycStatus === "REVIEW" ||
      (verificationCompleted &&
        liveKycStatus !== "APPROVED" &&
        liveKycStatus !== "REJECTED");

    if (!shouldPoll) {
      pollAttemptsRef.current = 0;
      return;
    }

    pollAttemptsRef.current = 0;
    let intervalId: number | undefined;

    const tick = async () => {
      pollAttemptsRef.current += 1;
      if (pollAttemptsRef.current > KYC_MAX_POLL_ATTEMPTS) {
        if (intervalId !== undefined) {
          window.clearInterval(intervalId);
        }
        return;
      }
      const result = await getKycStatusAction();
      if (result.success && result.data) {
        setLiveKycStatus(result.data.kycStatus);
        setLiveRejectionReason(result.data.kycRejectionReason ?? null);
        setLiveKycCompletedAt(result.data.kycCompletedAt ?? null);
        if (
          result.data.kycStatus === "APPROVED" ||
          result.data.kycStatus === "REJECTED"
        ) {
          router.refresh();
        }
      }
    };

    void tick();
    intervalId = window.setInterval(() => void tick(), KYC_POLL_INTERVAL_MS);

    return () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, [liveKycStatus, verificationCompleted, router]);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm leading-6">
          {t("description")}
        </p>
      </div>

      <div className="w-full space-y-8">
        {!isVerificationSubmitted && (
          <Steps currentStep={currentStep} steps={steps} />
        )}

        <Card className="overflow-hidden pt-0">
          {isVerificationSubmitted ? (
            <>
              <CardHeader className="rounded-t-xl bg-masumi-gradient pt-6 items-center">
                <CardTitle>
                  {liveKycStatus === "REVIEW"
                    ? t("Completion.processingTitle")
                    : t("Intro.rejectionTitle")}
                </CardTitle>
                <CardDescription>
                  {liveKycStatus === "REVIEW"
                    ? t("Completion.processingMessage")
                    : liveRejectionReason || t("Completion.rejectedMessage")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CompletionStep
                  verificationCompleted={liveKycStatus === "REVIEW"}
                  kycStatus={liveKycStatus}
                  rejectionReason={liveRejectionReason}
                  kycCompletedAt={liveKycCompletedAt}
                />
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="rounded-t-xl bg-masumi-gradient pt-6 items-center">
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
                    kycStatus={liveKycStatus}
                    rejectionReason={liveRejectionReason}
                  />
                )}
                {currentStep === 2 && accessToken && (
                  <SumsubStep
                    accessToken={accessToken}
                    onComplete={handleVerificationComplete}
                    onError={handleVerificationError}
                  />
                )}
                {currentStep === 3 && (
                  <CompletionStep
                    verificationCompleted={verificationCompleted}
                    kycStatus={liveKycStatus}
                    rejectionReason={liveRejectionReason}
                    kycCompletedAt={liveKycCompletedAt}
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
