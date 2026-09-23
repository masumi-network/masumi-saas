"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { SumsubStep } from "@/app/verification/components/sumsub-step";
import { Spinner } from "@/components/ui/spinner";
import {
  generateKycAccessTokenAction,
  getKycStatusAction,
  markKycAsSubmittedAction,
} from "@/lib/actions";

import { NetworkRegisterIntroStep } from "./network-register-intro-step";

const KYC_POLL_INTERVAL_MS = 4000;
const KYC_MAX_POLL_ATTEMPTS = 120;

interface NetworkRegisterKycFlowProps {
  draftId: string;
  kycStatus: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW";
  rejectionReason?: string | null;
  onLayoutWideChange?: (wide: boolean) => void;
}

export function NetworkRegisterKycFlow({
  draftId,
  kycStatus,
  rejectionReason,
  onLayoutWideChange,
}: NetworkRegisterKycFlowProps) {
  const t = useTranslations("App.NetworkRegister.verify");
  const router = useRouter();
  const continuePath = `/network-register/continue?draftId=${encodeURIComponent(draftId)}`;

  const [consentAccepted, setConsentAccepted] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [verificationCompleted, setVerificationCompleted] = useState(false);
  const [liveKycStatus, setLiveKycStatus] = useState(kycStatus);
  const [liveRejectionReason, setLiveRejectionReason] = useState(
    rejectionReason ?? null,
  );
  const pollAttemptsRef = useRef(0);

  useEffect(() => {
    setLiveKycStatus(kycStatus);
    setLiveRejectionReason(rejectionReason ?? null);
  }, [kycStatus, rejectionReason]);

  useEffect(() => {
    onLayoutWideChange?.(accessToken !== null);
  }, [accessToken, onLayoutWideChange]);

  useEffect(() => {
    if (liveKycStatus === "APPROVED") {
      router.replace(continuePath);
    }
  }, [liveKycStatus, continuePath, router]);

  const handleStartVerification = async () => {
    if (!consentAccepted) {
      toast.error(t("consentRequired"));
      return;
    }

    setIsLoadingToken(true);
    try {
      const result = await generateKycAccessTokenAction();
      if (result.success && result.data?.token) {
        setAccessToken(result.data.token);
      } else {
        toast.error(result.error || t("tokenGenerationFailed"));
      }
    } catch {
      toast.error(t("tokenGenerationFailed"));
    } finally {
      setIsLoadingToken(false);
    }
  };

  const handleVerificationComplete = async () => {
    const marked = await markKycAsSubmittedAction();
    if (!marked.success) {
      toast.error(marked.error || t("verificationFailed"));
      return;
    }

    const refreshed = await getKycStatusAction();
    if (refreshed.success && refreshed.data) {
      setLiveKycStatus(refreshed.data.kycStatus);
      setLiveRejectionReason(refreshed.data.kycRejectionReason ?? null);
    }

    setVerificationCompleted(true);
    router.refresh();
  };

  const handleVerificationError = (error: string) => {
    toast.error(error || t("verificationFailed"));
  };

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

  if (liveKycStatus === "APPROVED") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <Spinner size={48} className="text-primary" />
        <p className="text-sm text-muted-foreground">
          {t("finishingRegistration")}
        </p>
      </div>
    );
  }

  if (liveKycStatus === "REVIEW" || verificationCompleted) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <Spinner size={48} className="text-primary" />
        <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">
          {t("processingMessage")}
        </p>
      </div>
    );
  }

  if (liveKycStatus === "REJECTED") {
    return (
      <NetworkRegisterIntroStep
        consentAccepted={consentAccepted}
        onConsentChange={setConsentAccepted}
        onStart={() => {
          setLiveKycStatus("PENDING");
          void handleStartVerification();
        }}
        isLoading={isLoadingToken}
        kycStatus={liveKycStatus}
        rejectionReason={liveRejectionReason}
      />
    );
  }

  if (accessToken) {
    return (
      <SumsubStep
        accessToken={accessToken}
        onComplete={handleVerificationComplete}
        onError={handleVerificationError}
        showDescription={false}
        showSupportLink={false}
        wrapperClassName="space-y-0"
        containerClassName="border-0 bg-transparent"
      />
    );
  }

  return (
    <NetworkRegisterIntroStep
      consentAccepted={consentAccepted}
      onConsentChange={setConsentAccepted}
      onStart={handleStartVerification}
      isLoading={isLoadingToken}
      kycStatus={liveKycStatus}
      rejectionReason={liveRejectionReason}
    />
  );
}
