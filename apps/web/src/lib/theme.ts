export const THEME_TYPES = ["system", "light", "dark"] as const;

export type ThemeType = (typeof THEME_TYPES)[number];

export function isThemeType(value: string): value is ThemeType {
  return (THEME_TYPES as readonly string[]).includes(value);
}

export function resolveThemePreference(stored: string | null): ThemeType {
  if (stored && isThemeType(stored)) return stored;
  return "system";
}

/** Resolved appearance for UI that cannot use next-themes (e.g. global-error). */
export function resolveAppliedTheme(preference: ThemeType): "light" | "dark" {
  if (preference === "light" || preference === "dark") return preference;
  if (typeof window === "undefined") return "light";
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}
