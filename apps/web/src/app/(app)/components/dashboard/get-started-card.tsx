"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "masumi-get-started-dismissed";

type NextStep = {
  descriptionKey: "verifyEmail" | "registerAgent";
  ctaKey: "goToVerifyEmail" | "goToRegisterAgent";
  href: string;
};

function resolveNextStep({
  emailVerified,
  agentCount,
}: {
  emailVerified: boolean;
  agentCount: number;
}): NextStep | null {
  if (agentCount > 0) {
    return null;
  }

  if (!emailVerified) {
    return {
      descriptionKey: "verifyEmail",
      ctaKey: "goToVerifyEmail",
      href: "/account",
    };
  }

  return {
    descriptionKey: "registerAgent",
    ctaKey: "goToRegisterAgent",
    href: "/ai-agents",
  };
}

interface GetStartedCardProps {
  emailVerified: boolean;
  agentCount: number;
}

export function GetStartedCard({
  emailVerified,
  agentCount,
}: GetStartedCardProps) {
  const t = useTranslations("App.Home.Dashboard");
  const [isDismissed, setIsDismissed] = useState<boolean | null>(null);

  const nextStep = useMemo(
    () => resolveNextStep({ emailVerified, agentCount }),
    [agentCount, emailVerified],
  );

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

  if (isDismissed === null || isDismissed || nextStep == null) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-muted/20 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("getStarted.nextUp")}
        </p>
        <p className="mt-0.5 text-sm font-medium text-foreground">
          {t(`getStarted.${nextStep.descriptionKey}`)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button asChild variant="primary" size="sm">
          <Link href={nextStep.href}>{t(`getStarted.${nextStep.ctaKey}`)}</Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={handleDismiss}
        >
          {t("getStarted.notNow")}
        </Button>
      </div>
    </div>
  );
}
