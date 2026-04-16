// Strings in this file are intentionally hardcoded English because
// NextIntlClientProvider is not mounted at the global-error layer.
/* eslint-disable react/jsx-no-literals */
"use client";

import { useEffect, useState } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global error boundary. Catches errors thrown from the root layout itself
 * (those are not caught by app/error.tsx, which runs inside the root layout).
 *
 * Must render its own <html> and <body> because it replaces the root layout
 * entirely. Avoid importing components that depend on providers from the root
 * layout (theme, i18n, etc.) — they are not mounted when this renders. Strings
 * here are intentionally hardcoded English because NextIntlClientProvider is
 * unavailable at this layer; the `react/jsx-no-literals` rule is disabled
 * inline for the user-facing copy below. We detect theme directly from
 * next-themes's localStorage key + the system preference so the background
 * matches the user's chosen theme and no opposite-color flash is rendered.
 *
 * React error #461 is an internal selective-hydration sentinel that isn't a
 * real error; it occasionally leaks on Firefox when an RSC response stream is
 * interrupted. We reset silently in that case so the user never sees a flash.
 *
 * See: https://react.dev/errors/461
 */
function isSelectiveHydrationLeak(error: Error): boolean {
  const message = error.message ?? "";
  return (
    message.includes("Minified React error #461") ||
    message.includes("react.dev/errors/461")
  );
}

type Theme = "light" | "dark";

const DARK_PALETTE = {
  bg: "#0a0a0a",
  fg: "#fafafa",
  muted: "#a1a1aa",
  border: "#27272a",
  destructive: "#f87171",
  destructiveBorder: "#7f1d1d",
  btnBg: "transparent",
  btnBorder: "#3f3f46",
  btnHoverBg: "#18181b",
};

const LIGHT_PALETTE = {
  bg: "#ffffff",
  fg: "#0a0a0a",
  muted: "#52525b",
  border: "#e4e4e7",
  destructive: "#dc2626",
  destructiveBorder: "#fecaca",
  btnBg: "transparent",
  btnBorder: "#d4d4d8",
  btnHoverBg: "#f4f4f5",
};

function resolveInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage may be blocked — fall through to media query
  }
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "dark";
  }
}

const FADE_IN_KEYFRAMES =
  "@keyframes masumiGlobalErrorFadeIn { from { opacity: 0 } to { opacity: 1 } }";

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const [autoResetAttempted, setAutoResetAttempted] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => resolveInitialTheme());

  useEffect(() => {
    if (isSelectiveHydrationLeak(error) && !autoResetAttempted) {
      // Intentionally update state from an effect to guard reset() from
      // looping if the leak reoccurs on the next render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAutoResetAttempted(true);
      reset();
    }
  }, [error, reset, autoResetAttempted]);

  useEffect(() => {
    // Sync theme if the user changed it between when this error mounted and
    // any later render (e.g. system preference change).
    const resolved = resolveInitialTheme();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (resolved !== theme) setTheme(resolved);
  }, [theme]);

  const palette = theme === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
  const shouldHide = isSelectiveHydrationLeak(error) && !autoResetAttempted;

  return (
    <html lang="en" data-theme={theme}>
      <body
        style={{
          margin: 0,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          backgroundColor: palette.bg,
          color: palette.fg,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          colorScheme: theme,
        }}
      >
        <style>{FADE_IN_KEYFRAMES}</style>
        {shouldHide ? null : (
          <div
            style={{
              maxWidth: "28rem",
              border: `1px solid ${palette.destructiveBorder}`,
              borderRadius: "0.5rem",
              padding: "1.5rem",
              backgroundColor: palette.bg,
              opacity: 0,
              animation:
                "masumiGlobalErrorFadeIn 150ms ease-out 500ms forwards",
            }}
          >
            <h2
              style={{
                color: palette.destructive,
                fontSize: "1.125rem",
                fontWeight: 600,
                margin: 0,
              }}
            >
              Something went wrong
            </h2>
            <p
              style={{
                marginTop: "0.5rem",
                marginBottom: "1rem",
                fontSize: "0.875rem",
                color: palette.muted,
              }}
            >
              An unexpected error occurred. Please try again.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                border: `1px solid ${palette.btnBorder}`,
                background: palette.btnBg,
                color: palette.fg,
                padding: "0.5rem 0.875rem",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = palette.btnHoverBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = palette.btnBg;
              }}
            >
              Try again
            </button>
          </div>
        )}
      </body>
    </html>
  );
}
