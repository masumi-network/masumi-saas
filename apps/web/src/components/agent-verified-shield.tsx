"use client";

import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { verifiableCredentialsSdkDocUrl } from "@/lib/config/verification.config";
import { cn } from "@/lib/utils";

const sizeClass = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
} as const;

/**
 * Shield + check shown next to an agent name when `verificationStatus === "VERIFIED"`.
 */
export function AgentVerifiedShield({
  className,
  size = "sm",
}: {
  className?: string;
  size?: keyof typeof sizeClass;
}) {
  const t = useTranslations("App.Agents.status");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex shrink-0 cursor-default touch-manipulation items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className,
          )}
        >
          <ShieldCheck
            className={cn(
              sizeClass[size],
              "text-green-600 dark:text-green-500",
            )}
            aria-hidden
          />
          <span className="sr-only">{t("verifiedShieldAriaSummary")}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {t.rich("verifiedShieldTooltip", {
          docsLink: (chunks) => (
            <a
              href={verifiableCredentialsSdkDocUrl}
              target="_blank"
              rel="noopener noreferrer"
              onPointerDown={(event) => event.stopPropagation()}
            >
              {chunks}
            </a>
          ),
        })}
      </TooltipContent>
    </Tooltip>
  );
}
