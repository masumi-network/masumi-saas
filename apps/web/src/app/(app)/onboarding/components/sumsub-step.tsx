"use client";

import snsWebSdk from "@sumsub/websdk";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { Spinner } from "@/components/ui/spinner";

interface SumsubStepProps {
  accessToken: string;
  onComplete: () => void;
  onError: (error: string) => void;
}

export function SumsubStep({
  accessToken,
  onComplete,
  onError,
}: SumsubStepProps) {
  const t = useTranslations("App.Onboarding.Verification");
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sdkRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !accessToken) return;

    try {
      sdkRef.current = snsWebSdk
        .init(accessToken, () => {
          return Promise.resolve(accessToken);
        })
        .withConf({
          lang: "en",
          theme: "light",
        })
        .withOptions({
          addViewportTag: false,
          adaptIframeHeight: true,
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on("idCheck.onStepCompleted", (payload: any) => {
          console.log("Step completed:", payload);
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on("idCheck.onError", (error: any) => {
          console.error("Sumsub SDK error:", error);
          onError(error?.message || t("error"));
        })
        .on("idCheck.onApplicantSubmitted", () => {
          console.log("Applicant submitted");
          onComplete();
        })
        .build();

      sdkRef.current.mount(containerRef.current);
    } catch (error) {
      console.error("Failed to initialize Sumsub SDK:", error);
      onError(error instanceof Error ? error.message : t("error"));
    }

    return () => {
      if (sdkRef.current) {
        try {
          sdkRef.current.unmount();
        } catch (error) {
          console.error("Error unmounting Sumsub SDK:", error);
        }
      }
    };
  }, [accessToken, onComplete, onError, t]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">{t("description")}</div>
      <div
        ref={containerRef}
        id="sumsub-websdk-container"
        className="min-h-[600px] w-full"
      />
      {!containerRef.current && (
        <div className="flex items-center justify-center py-8">
          <Spinner size={24} />
        </div>
      )}
    </div>
  );
}
