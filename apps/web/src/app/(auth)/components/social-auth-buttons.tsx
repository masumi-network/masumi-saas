"use client";

import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import {
  GithubLoginButton,
  GoogleLoginButton,
  MicrosoftLoginButton,
} from "react-social-login-buttons";

import { authClient } from "@/lib/auth/auth.client";
import { sanitizeCallbackUrl } from "@/lib/auth/callback-url";

type OAuthProvider = "google" | "github" | "microsoft";

interface SocialAuthButtonsProps {
  /** Providers to show. Pass from server based on env config. */
  providers?: OAuthProvider[];
  /** After OAuth, redirect here (e.g. from accept-invitation). Must be a path on our origin. */
  callbackURL?: string;
}

/**
 * Inline styles override react-social-login-buttons defaults (brand-colored fills).
 * Keeps Google / GitHub / Microsoft visually aligned with shadcn outline buttons.
 */
const OAUTH_NEUTRAL_STYLE: CSSProperties = {
  background: "hsl(var(--background))",
  color: "hsl(var(--foreground))",
  border: "1px solid hsl(var(--input))",
  borderRadius: "0.375rem",
  boxShadow: "none",
  margin: 0,
  width: "100%",
  height: "auto",
  minHeight: "42px",
  fontSize: "14px",
  fontWeight: 500,
  padding: "8px 16px",
  overflow: "hidden",
};

const OAUTH_HOVER_STYLE: CSSProperties = {
  background: "hsl(var(--accent))",
  color: "hsl(var(--accent-foreground))",
};

/**
 * react-social-login-buttons uses [icon][spacer][text@100%], so labels center in the
 * full width while icons stay left. Hide the spacer, shrink the text cell, and center
 * the row so icon + copy sit together like our native buttons.
 */
const OAUTH_BUTTON_CLASS =
  "!m-0 !w-full max-w-none [&>div]:flex [&>div]:w-full [&>div]:items-center [&>div]:justify-center [&>div]:gap-4 [&>div>div:nth-child(2)]:hidden [&>div>div:first-child]:!min-w-0 [&>div>div:last-child]:!w-auto [&>div>div:last-child]:!shrink-0";

const OAUTH_ICON_COLOR = "hsl(var(--foreground))";

/**
 * Social providers + divider before the email form.
 * All providers use the same library + neutral shell so they match each other.
 */
export function SocialAuthButtons({
  providers = [],
  callbackURL,
}: SocialAuthButtonsProps) {
  const t = useTranslations("Auth.SignIn");
  const tSocial = useTranslations("Auth.Social");

  const handleSocialSignIn = (provider: OAuthProvider) => {
    authClient.signIn.social({
      provider,
      callbackURL: sanitizeCallbackUrl(callbackURL) ?? "/",
    });
  };

  if (providers.length === 0) return null;

  const shared = {
    align: "center" as const,
    type: "button" as const,
    size: "42px",
    iconSize: 22,
    iconColor: OAUTH_ICON_COLOR,
    style: OAUTH_NEUTRAL_STYLE,
    activeStyle: OAUTH_HOVER_STYLE,
    className: OAUTH_BUTTON_CLASS,
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3">
        {providers.includes("google") && (
          <GoogleLoginButton
            {...shared}
            text={t("continueWithGoogle")}
            onClick={() => handleSocialSignIn("google")}
          />
        )}
        {providers.includes("github") && (
          <GithubLoginButton
            {...shared}
            text={t("continueWithGithub")}
            onClick={() => handleSocialSignIn("github")}
          />
        )}
        {providers.includes("microsoft") && (
          <MicrosoftLoginButton
            {...shared}
            text={t("continueWithMicrosoft")}
            onClick={() => handleSocialSignIn("microsoft")}
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <hr className="h-0 flex-1 border-0 border-t border-border" />
        <span className="text-xs uppercase text-muted-foreground">
          {tSocial("emailFormDivider")}
        </span>
        <hr className="h-0 flex-1 border-0 border-t border-border" />
      </div>
    </div>
  );
}
