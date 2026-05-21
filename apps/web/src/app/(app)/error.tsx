"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { ErrorBoundaryActions } from "@/components/error-boundary-actions";
import { ErrorPageLayout } from "@/components/error-page-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * React error #461 is an internal selective-hydration sentinel that isn't a
 * real error. It occasionally leaks into userspace on Firefox when an RSC
 * response stream is interrupted (e.g. back/forward navigation). When that
 * happens, we reset the boundary silently so the user never sees a flash of
 * Next.js's default "Application error" UI.
 *
 * See: https://react.dev/errors/461
 */
function isSelectiveHydrationLeak(error: Error): boolean {
  const message = error.message ?? "";
  return (
    message.includes("Minified React error #461") ||
    message.includes("react.dev/errors/461")
  );
}

export default function AppGroupError({ error, reset }: ErrorBoundaryProps) {
  const t = useTranslations("Common.ErrorBoundary");
  const [autoResetAttempted, setAutoResetAttempted] = useState(false);

  useEffect(() => {
    if (isSelectiveHydrationLeak(error) && !autoResetAttempted) {
      // Intentionally update state from an effect to guard reset() from looping
      // if the leak reoccurs on the next render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAutoResetAttempted(true);
      reset();
    }
  }, [error, reset, autoResetAttempted]);

  if (isSelectiveHydrationLeak(error) && !autoResetAttempted) {
    return null;
  }

  return (
    <ErrorPageLayout variant="app">
      <Card className="animate-in fade-in fill-mode-both delay-500 duration-150 w-full border-destructive shadow-md">
        <CardHeader>
          <CardTitle className="text-destructive">{t("title")}</CardTitle>
          <CardDescription>{t("descriptionApp")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ErrorBoundaryActions onRetry={reset} />
        </CardContent>
      </Card>
    </ErrorPageLayout>
  );
}
