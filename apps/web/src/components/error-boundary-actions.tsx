"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  MASUMI_EXTERNAL_LINK_PROPS,
  SUPPORT_PAGE_URL,
} from "@/lib/config/masumi-external-links";

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
        <a href={SUPPORT_PAGE_URL} {...MASUMI_EXTERNAL_LINK_PROPS}>
          {t("support")}
        </a>
      </Button>
    </div>
  );
}
