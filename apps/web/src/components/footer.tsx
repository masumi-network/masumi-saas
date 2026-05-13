"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Locale } from "@/i18n/config";
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
          href="https://discord.com/invite/aj4QfnTS92"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs sm:text-sm text-muted-foreground hover:text-foreground tracking-tight transition-colors duration-200"
        >
          {t("discord")}
        </Link>
        <Link
          href="https://www.house-of-communication.com/de/en/footer/privacy-policy.html"
          className="text-xs sm:text-sm text-muted-foreground hover:text-foreground tracking-tight transition-colors duration-200"
        >
          {t("privacyPolicy")}
        </Link>
        <Link
          href="https://www.masumi.network/imprint"
          className="text-xs sm:text-sm text-muted-foreground hover:text-foreground tracking-tight transition-colors duration-200"
        >
          {t("legal")}
        </Link>
      </div>
    </div>
  );
}
