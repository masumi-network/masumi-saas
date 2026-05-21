"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

const MASUMI_DISCORD_URL = "https://discord.com/invite/aj4QfnTS92";

type ErrorBoundaryActionsProps = {
  onRetry: () => void;
};

export function ErrorBoundaryActions({ onRetry }: ErrorBoundaryActionsProps) {
  const t = useTranslations("Common.ErrorBoundary");

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" onClick={onRetry} variant="outline">
        {t("retry")}
      </Button>
      <Button type="button" variant="outline" asChild>
        <a href={MASUMI_DISCORD_URL} target="_blank" rel="noopener noreferrer">
          {t("support")}
        </a>
      </Button>
    </div>
  );
}
