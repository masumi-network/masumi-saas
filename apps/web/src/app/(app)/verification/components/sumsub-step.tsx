"use client";

import snsWebSdk from "@sumsub/websdk";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

import {
  MASUMI_EXTERNAL_LINK_PROPS,
  SUPPORT_PAGE_URL,
} from "@/lib/config/masumi-external-links";
import { cn } from "@/lib/utils";
import { extractErrorMessage } from "@/lib/utils/extract-error";

interface SumsubStepProps {
  accessToken: string;
  onComplete: () => void;
  onError: (error: string) => void;
  showDescription?: boolean;
  showSupportLink?: boolean;
  containerClassName?: string;
  wrapperClassName?: string;
}

export function SumsubStep({
  accessToken,
  onComplete,
  onError,
  showDescription = true,
  showSupportLink = true,
  containerClassName,
  wrapperClassName,
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
          .on("idCheck.onStepCompleted", (payload: unknown) => {
            const p = payload as Record<string, unknown> | null;
            if (
              p?.reviewStatus === "completed" ||
              p?.actionId === "verificationCompleted" ||
              p?.type === "verificationCompleted"
            ) {
              onComplete();
            }
          })
          .on("idCheck.onError", (error: unknown) => {
            console.error("Sumsub SDK error:", error);
            onError(extractErrorMessage(error, t("error")));
          })

          .on("idCheck.onApplicantSubmitted", () => {
            onComplete();
          })
          .build();

        sdkRef.current = sdk;

        const sdkInstance = sdk as unknown as Record<string, unknown>;

        if (sdkInstance && typeof sdkInstance.launch === "function") {
          (sdkInstance.launch as (id: string) => void)(
            "#sumsub-websdk-container",
          );
        } else if (sdkInstance?.iframe && containerRef.current) {
          containerRef.current.appendChild(sdkInstance.iframe as Node);
        } else {
          console.error(
            "Failed to initialize Sumsub SDK: launch method not available",
          );
          onError("Failed to initialize verification SDK");
        }
      } catch (error) {
        console.error("Failed to initialize Sumsub SDK:", error);
        onError(extractErrorMessage(error, t("error")));
      }
    };

    void initializeSDK();

    return () => {
      if (sdkRef.current) {
        try {
          const sdkInstance = sdkRef.current as unknown as Record<
            string,
            unknown
          >;
          if (typeof sdkInstance.unmount === "function") {
            sdkInstance.unmount();
          } else if (typeof sdkInstance.destroy === "function") {
            sdkInstance.destroy();
          } else if (sdkInstance.iframe) {
            const iframe = sdkInstance.iframe as HTMLElement;
            iframe.parentNode?.removeChild(iframe);
          }
        } catch (error) {
          console.error("Error unmounting Sumsub SDK:", error);
        }
      }
    };
  }, [accessToken, onComplete, onError, t, resolvedTheme]);

  return (
    <div className={cn("space-y-4", wrapperClassName)}>
      {showDescription ? (
        <div className="text-sm text-muted-foreground">{t("description")}</div>
      ) : null}
      <div
        ref={containerRef}
        id="sumsub-websdk-container"
        className={cn(
          "w-full overflow-hidden rounded-lg border border-border [&_iframe]:!block [&_iframe]:!max-w-none [&_iframe]:!w-full",
          containerClassName,
        )}
      />
      {showSupportLink ? (
        <div className="flex justify-end">
          <Link
            href={SUPPORT_PAGE_URL}
            {...MASUMI_EXTERNAL_LINK_PROPS}
            className="text-sm text-primary hover:underline"
          >
            {t("havingIssues")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
