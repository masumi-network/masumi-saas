"use client";

import snsWebSdk from "@sumsub/websdk";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

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
  const t = useTranslations("App.Verification.Verification");
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
            if (
              payload?.reviewStatus === "completed" ||
              payload?.actionId === "verificationCompleted" ||
              payload?.type === "verificationCompleted"
            ) {
              onComplete();
            }
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .on("idCheck.onError", (error: any) => {
            console.error("Sumsub SDK error:", error);
            onError(error?.message || t("error"));
          })

          .on("idCheck.onApplicantSubmitted", () => {
            onComplete();
          })
          .build();

        sdkRef.current = sdk;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sdkInstance = sdk as any;

        if (sdkInstance && typeof sdkInstance.launch === "function") {
          sdkInstance.launch("#sumsub-websdk-container");
        } else if (sdkInstance?.iframe && containerRef.current) {
          containerRef.current.appendChild(sdkInstance.iframe);
        } else {
          console.error(
            "Failed to initialize Sumsub SDK: launch method not available",
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
      <div className="flex justify-end">
        <Link
          href="https://www.masumi.network/contact"
          target="_blank"
          className="text-sm text-primary hover:underline"
        >
          {t("havingIssues")}
        </Link>
      </div>
    </div>
  );
}
