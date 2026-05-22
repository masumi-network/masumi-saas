"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { THEME_TYPES, type ThemeType } from "@/lib/theme";
import { cn } from "@/lib/utils";

const THEME_ICONS: Record<ThemeType, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

const SEGMENT_COUNT = THEME_TYPES.length;
const SEGMENT_CLASS = "size-6";
/** `size-6` × 3 + `gap-1.5` × 2 + `p-1.5` × 2 */
const PILL_STEP = "calc(1.5rem + 0.375rem)";

type ThemeSettingProps = {
  /** Icons only — for footer / auth chrome */
  variant?: "default" | "compact";
  className?: string;
};

export function ThemeSetting({
  variant = "default",
  className,
}: ThemeSettingProps) {
  const isCompact = variant === "compact";
  const t = useTranslations("Components.ThemeSetting");
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const activeTheme: ThemeType =
    mounted && theme && THEME_TYPES.includes(theme as ThemeType)
      ? (theme as ThemeType)
      : "system";

  const selectedIndex = Math.max(0, THEME_TYPES.indexOf(activeTheme));

  const cycleTheme = () => {
    const nextIndex = (selectedIndex + 1) % SEGMENT_COUNT;
    setTheme(THEME_TYPES[nextIndex]!);
  };

  if (!mounted) {
    return (
      <div
        className={cn(
          "h-8 w-8 shrink-0 rounded-lg bg-muted/80",
          !isCompact && "md:h-9 md:w-24 md:ring-1 md:ring-border/60",
          className,
        )}
        aria-hidden
      />
    );
  }

  return (
    <div className={cn("inline-flex shrink-0", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "relative h-8 w-8 shrink-0 bg-background p-2",
          isCompact ? "flex" : "md:hidden",
        )}
        onClick={cycleTheme}
        aria-label={t(activeTheme)}
        title={t(activeTheme)}
      >
        {THEME_TYPES.map((themeType) => {
          const Icon = THEME_ICONS[themeType];
          const isActive = activeTheme === themeType;
          return (
            <Icon
              key={themeType}
              aria-hidden
              className={cn(
                "absolute size-4 transition-all duration-300",
                isActive
                  ? "scale-100 rotate-0 opacity-100"
                  : "scale-0 rotate-90 opacity-0",
              )}
            />
          );
        })}
      </Button>

      <div
        role="radiogroup"
        aria-label={t("ariaLabel")}
        className={cn(
          "relative hidden h-9 w-24 shrink-0 items-center gap-1.5 rounded-lg bg-muted/80 p-1.5 ring-1 ring-border/60",
          isCompact ? "hidden" : "md:flex",
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute top-1.5 left-1.5 rounded-md bg-background shadow-sm transition-transform duration-200 ease-out",
            SEGMENT_CLASS,
          )}
          style={{
            transform: `translateX(calc(${selectedIndex} * ${PILL_STEP}))`,
          }}
          aria-hidden
        />
        {THEME_TYPES.map((themeType) => {
          const Icon = THEME_ICONS[themeType];
          const isActive = activeTheme === themeType;
          return (
            <button
              key={themeType}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={t(themeType)}
              title={t(themeType)}
              onClick={() => setTheme(themeType)}
              className={cn(
                "relative z-10 flex shrink-0 items-center justify-center rounded-md transition-colors",
                SEGMENT_CLASS,
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}
