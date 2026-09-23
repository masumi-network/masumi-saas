"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Locale } from "@/i18n/config";
import {
  DISCORD_INVITE_URL,
  IMPRINT_PAGE_URL,
  MASUMI_EXTERNAL_LINK_PROPS,
} from "@/lib/config/masumi-external-links";
import {
  PRIVACY_POLICY_LINK_PROPS,
  PRIVACY_POLICY_URL,
} from "@/lib/config/privacy-policy-url";
import { cn } from "@/lib/utils";

interface FooterProps {
  className?: string | undefined;
}

export default function Footer({ className }: FooterProps) {
  return (
    <footer className={cn("space-y-6", className)}>
      <FooterSections className="container mx-auto px-4 pt-14 md:px-12 md:pt-12" />
    </footer>
  );
}

interface FooterSectionsProps {
  className?: string;
}

export function FooterSections({ className }: FooterSectionsProps) {
  const t = useTranslations("Footer");
  const locale = useLocale() as Locale;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 w-full",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LocaleSwitcher currentLocale={locale} />
      </div>
      <div className="flex flex-wrap items-center flex-1 justify-end gap-4">
        <Link
          href={DISCORD_INVITE_URL}
          {...MASUMI_EXTERNAL_LINK_PROPS}
          className="text-xs sm:text-sm text-muted-foreground hover:text-foreground tracking-tight transition-colors duration-200"
        >
          {t("discord")}
        </Link>
        <Link
          href={PRIVACY_POLICY_URL}
          {...PRIVACY_POLICY_LINK_PROPS}
          className="text-xs sm:text-sm text-muted-foreground hover:text-foreground tracking-tight transition-colors duration-200"
        >
          {t("privacyPolicy")}
        </Link>
        <Link
          href={IMPRINT_PAGE_URL}
          {...MASUMI_EXTERNAL_LINK_PROPS}
          className="text-xs sm:text-sm text-muted-foreground hover:text-foreground tracking-tight transition-colors duration-200"
        >
          {t("imprint")}
        </Link>
      </div>
    </div>
  );
}
