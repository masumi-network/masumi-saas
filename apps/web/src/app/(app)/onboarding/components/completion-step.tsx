"use client";

import { Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

interface CompletionStepProps {
  verificationCompleted: boolean;
  kycStatus?: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW";
  rejectionReason?: string | null;
  kycCompletedAt?: Date | null;
}

export function CompletionStep({
  verificationCompleted,
  kycStatus,
  rejectionReason,
  kycCompletedAt,
}: CompletionStepProps) {
  const t = useTranslations("App.Onboarding.Completion");
  const tStatus = useTranslations("App.Home.KycStatus");
  const router = useRouter();

  if (kycStatus === "REJECTED") {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <XCircle className="h-16 w-16 text-destructive" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">{t("rejectedTitle")}</h3>
          <p className="text-muted-foreground mt-2">
            {rejectionReason || t("rejectedMessage")}
          </p>
        </div>
        <Button onClick={() => router.refresh()} className="w-full">
          {t("retryButton")}
        </Button>
      </div>
    );
  }

  if (kycStatus === "REVIEW") {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">{t("processingTitle")}</h3>
          <p className="text-muted-foreground mt-2">{t("processingMessage")}</p>
        </div>
      </div>
    );
  }

  if (kycStatus === "APPROVED") {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <ShieldCheck className="h-16 w-16 text-green-500" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">{tStatus("approved.title")}</h3>
          <p className="text-muted-foreground mt-2">
            {kycCompletedAt
              ? tStatus("approved.descriptionWithDate", {
                  date: new Date(kycCompletedAt).toLocaleString(),
                })
              : tStatus("approved.description")}
          </p>
        </div>
        <Button
          onClick={() => {
            router.refresh();
            setTimeout(() => {
              router.push("/");
            }, 500);
          }}
          className="w-full"
        >
          {t("continueButton")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center">
      {verificationCompleted ? (
        <>
          <div className="flex justify-center">
            <ShieldCheck className="h-16 w-16 text-green-500" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">{t("successTitle")}</h3>
            <p className="text-muted-foreground mt-2">{t("successMessage")}</p>
          </div>
          <Button
            onClick={() => {
              // Refresh to get latest status, then navigate
              router.refresh();
              setTimeout(() => {
                router.push("/");
              }, 500);
            }}
            className="w-full"
          >
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
