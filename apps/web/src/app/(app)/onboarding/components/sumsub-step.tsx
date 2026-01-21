"use client";

import snsWebSdk from "@sumsub/websdk";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

interface SumsubStepProps {
  accessToken: string;
  onComplete: () => void;
  onError: (error: string) => void;
  onManualContinue?: () => void;
}

export function SumsubStep({
  accessToken,
  onComplete,
  onError,
  onManualContinue,
}: SumsubStepProps) {
  const t = useTranslations("App.Onboarding.Verification");
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sdkRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !accessToken) return;

    const initializeSDK = async () => {
      try {
        const sdk = snsWebSdk
          .init(accessToken, () => {
            return Promise.resolve(accessToken);
          })
          .withConf({
            lang: "en",
            theme: resolvedTheme === "dark" ? "dark" : "light",
          })
          .withOptions({
            addViewportTag: false,
            adaptIframeHeight: true,
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .on("idCheck.onStepCompleted", (payload: any) => {
            console.log("Step completed:", payload);
            // Check if this is the final step (verification complete)
            // The payload might indicate completion status
            if (
              payload?.reviewStatus === "completed" ||
              payload?.actionId === "verificationCompleted" ||
              payload?.type === "verificationCompleted"
            ) {
              console.log("Verification completed via onStepCompleted");
              onComplete();
            }
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .on("idCheck.onError", (error: any) => {
            console.error("Sumsub SDK error:", error);
            onError(error?.message || t("error"));
          })
          .on("idCheck.onApplicantSubmitted", () => {
            console.log("Applicant submitted - moving to completion step");
            // When applicant submits, move to completion step
            // The actual approval/rejection will come via webhook
            onComplete();
          })
          .build();

        sdkRef.current = sdk;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sdkInstance = sdk as any;

        // Try launch() with container selector (WebSDK 2.0)
        if (sdkInstance && typeof sdkInstance.launch === "function") {
          sdkInstance.launch("#sumsub-websdk-container");
        } else if (sdkInstance?.iframe && containerRef.current) {
          // If SDK has iframe property, append it to container
          containerRef.current.appendChild(sdkInstance.iframe);
        } else {
          console.error(
            "SDK launch method not available. SDK object:",
            sdkInstance,
          );
          console.error(
            "Available properties:",
            Object.keys(sdkInstance || {}),
          );
          onError("Failed to initialize verification SDK");
        }
      } catch (error) {
        console.error("Failed to initialize Sumsub SDK:", error);
        onError(error instanceof Error ? error.message : t("error"));
      }
    };

    initializeSDK();

    return () => {
      if (sdkRef.current) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sdkInstance = sdkRef.current as any;
          if (typeof sdkInstance.unmount === "function") {
            sdkInstance.unmount();
          } else if (typeof sdkInstance.destroy === "function") {
            sdkInstance.destroy();
          } else if (sdkInstance.iframe && sdkInstance.iframe.parentNode) {
            sdkInstance.iframe.parentNode.removeChild(sdkInstance.iframe);
          }
        } catch (error) {
          console.error("Error unmounting Sumsub SDK:", error);
        }
      }
    };
  }, [accessToken, onComplete, onError, t, resolvedTheme]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">{t("description")}</div>
      <div
        ref={containerRef}
        id="sumsub-websdk-container"
        className="w-full rounded-lg overflow-hidden border border-border"
      />
      {onManualContinue && (
        <div className="flex justify-end">
          <button
            onClick={onManualContinue}
            className="text-sm text-primary hover:underline"
            type="button"
          >
            {t("continueManually")}
          </button>
        </div>
      )}
    </div>
  );
}
