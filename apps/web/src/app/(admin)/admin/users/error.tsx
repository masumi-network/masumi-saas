"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

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

export default function AdminUsersError({ error, reset }: ErrorBoundaryProps) {
  const t = useTranslations("Admin.Users");

  useEffect(() => {
    console.error("Admin users page error:", error.digest ?? "no-digest");
  }, [error.digest, error.message]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("description")}</p>
      </div>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">
            {t("errorLoadingUsers")}
          </CardTitle>
          <CardDescription>{t("errorDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={reset} variant="outline">
            {t("tryAgain")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
