"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Locale, locales } from "@/i18n/config";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  ja: "日本語",
  fr: "Français",
  es: "Español",
};

interface LocaleSwitcherProps {
  currentLocale: Locale;
}

export function LocaleSwitcher({ currentLocale }: LocaleSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function switchLocale(locale: Locale) {
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
    <select
      value={currentLocale}
      onChange={(e) => switchLocale(e.target.value as Locale)}
      disabled={isPending}
      aria-label="Language"
    >
      {locales.map((code) => (
        <option key={code} value={code}>
          {LOCALE_LABELS[code]}
        </option>
      ))}
    </select>
  );
}
