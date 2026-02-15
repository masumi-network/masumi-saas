"use client";

import { CheckCircle2, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STORAGE_KEY = "masumi-get-started-dismissed";

interface GetStartedCardProps {
  user: { emailVerified: boolean };
  isKycCompleted: boolean;
  kycError?: string;
  needsKycAction: boolean;
}

export function GetStartedCard({
  user,
  isKycCompleted,
  kycError,
  needsKycAction,
}: GetStartedCardProps) {
  const t = useTranslations("App.Home.Dashboard");
  const [isDismissed, setIsDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    queueMicrotask(() =>
      setIsDismissed(localStorage.getItem(STORAGE_KEY) === "1"),
    );
  }, []);

  const handleDismiss = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "1");
      setIsDismissed(true);
    }
  }, []);

  if (isDismissed === null || isDismissed) return null;

  return (
    <Card className="rounded-lg border-amber-500/15 bg-amber-500/5 shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base">{t("getStarted.title")}</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
            aria-label={t("getStarted.dismiss")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>{t("getStarted.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          <li className="flex items-center gap-3">
            {user.emailVerified ? (
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {t("getStarted.step1")}
              </span>
            )}
            <span
              className={`flex-1 text-sm ${user.emailVerified ? "text-muted-foreground" : ""}`}
            >
              {!user.emailVerified
                ? t("getStarted.verifyEmail")
                : t("getStarted.verifyEmailDone")}
            </span>
            {!user.emailVerified && (
              <Button asChild size="sm" variant="ghost">
                <Link href="/account">{t("getStarted.doIt")}</Link>
              </Button>
            )}
          </li>
          <li className="flex items-center gap-3">
            {isKycCompleted ? (
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {t("getStarted.step2")}
              </span>
            )}
            <span
              className={`flex-1 text-sm ${isKycCompleted ? "text-muted-foreground" : ""}`}
            >
              {kycError
                ? t("kycLoadError")
                : needsKycAction
                  ? t("getStarted.completeKyc")
                  : t("getStarted.completeKycDone")}
            </span>
            {needsKycAction && (
              <Button asChild size="sm" variant="ghost">
                <Link href="/verification">{t("getStarted.doIt")}</Link>
              </Button>
            )}
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
              {t("getStarted.step3")}
            </span>
            <span className="flex-1 text-sm">{t("getStarted.createOrg")}</span>
            <Button asChild size="sm" variant="ghost">
              <Link href="/organizations">{t("getStarted.doIt")}</Link>
            </Button>
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
              {t("getStarted.step4")}
            </span>
            <span className="flex-1 text-sm">
              {t("getStarted.registerAgent")}
            </span>
            <Button asChild size="sm" variant="ghost">
              <Link href="/ai-agents">{t("getStarted.doIt")}</Link>
            </Button>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
