"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Locale, locales } from "@/i18n/config";
import { cn } from "@/lib/utils";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  ja: "日本語",
  fr: "Français",
  es: "Español",
};

interface LocaleSwitcherProps {
  currentLocale: Locale;
  className?: string;
}

/**
 * Locale switcher using the same shadcn {@link Select} pattern as
 * {@link OrganizationSelect} (account page workspace switcher).
 */
export function LocaleSwitcher({
  currentLocale,
  className,
}: LocaleSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function switchLocale(locale: Locale) {
    if (locale === currentLocale) return;
    try {
      const response = await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (!response.ok) throw new Error("Failed to set locale");
      startTransition(() => router.refresh());
    } catch (error) {
      console.error("Locale switch failed:", error);
    }
  }

  return (
    <Select
      value={currentLocale}
      onValueChange={(v) => void switchLocale(v as Locale)}
      disabled={isPending}
    >
      <SelectTrigger
        aria-label="Language"
        className={cn(
          "h-8 w-fit max-w-64 flex items-center gap-2 [&>svg]:shrink-0",
          className,
        )}
      >
        <div className="min-w-0 flex-1 overflow-hidden [&_span]:block [&_span]:truncate [&_span]:min-w-0">
          <SelectValue className="text-sm" />
        </div>
      </SelectTrigger>
      <SelectContent align="end">
        {locales.map((code) => (
          <SelectItem key={code} value={code}>
            {LOCALE_LABELS[code]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
