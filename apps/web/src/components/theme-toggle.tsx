"use client";

import { ThemeSetting } from "@/components/theme-setting";

/** @deprecated Use {@link ThemeSetting} — kept for existing imports. */
export function ThemeToggle() {
  return <ThemeSetting variant="compact" />;
}
