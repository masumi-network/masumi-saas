"use client";

import { useEffect, useRef } from "react";

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
  const autoResetAttempted = useRef(false);

  useEffect(() => {
    if (isSelectiveHydrationLeak(error) && !autoResetAttempted.current) {
      autoResetAttempted.current = true;
      reset();
    }
  }, [error, reset]);

  if (isSelectiveHydrationLeak(error) && !autoResetAttempted.current) {
    return null;
  }

  return (
    <div className="bg-background text-foreground flex min-h-svh items-center justify-center p-4">
      <Card className="animate-in fade-in fill-mode-both delay-500 duration-150 max-w-md border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">
            Something went wrong
          </CardTitle>
          <CardDescription>
            An unexpected error occurred while loading this page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={reset} variant="outline">
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
