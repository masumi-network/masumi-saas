"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
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
 * Root-level error boundary. Catches errors thrown from any route that doesn't
 * have a nested error.tsx closer to it (e.g. /signin, /oidc/*). Errors thrown
 * from the root layout itself are handled by global-error.tsx instead.
 *
 * React error #461 is an internal selective-hydration sentinel that isn't a
 * real error; it occasionally leaks on Firefox when an RSC response stream is
 * interrupted. We reset silently in that case so the user never sees a flash
 * of Next.js's default "Application error" UI.
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

export default function RootError({ error, reset }: ErrorBoundaryProps) {
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
    <div className="bg-background text-foreground flex min-h-svh items-center justify-center p-4">
      <Card className="animate-in fade-in fill-mode-both delay-500 duration-150 max-w-md border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">{t("title")}</CardTitle>
          <CardDescription>{t("descriptionRoot")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={reset} variant="outline">
            {t("retry")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
