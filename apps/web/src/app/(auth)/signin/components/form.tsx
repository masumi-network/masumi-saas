"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { SocialAuthButtons } from "@/auth/components/social-auth-buttons";
import { AuthPageHeader } from "@/components/auth-page-header";
import { Button } from "@/components/ui/button";
import { buildAuthPageHref } from "@/lib/auth/auth-page-callback-url";
import { sanitizeCallbackUrl } from "@/lib/auth/callback-url";
import type { MagicLinkSignInInput, SignInInput } from "@/lib/schemas";

import { MagicLinkCheckEmailHeader } from "../../components/magic-link-check-email-header";
import { MagicLinkCodePanel } from "../../components/magic-link-code-panel";
import {
  SigninMagicLinkForm,
  type SigninMagicLinkFormHandle,
} from "./signin-magic-link-form";
import {
  SigninPasswordForm,
  type SigninPasswordFormHandle,
} from "./signin-password-form";

interface SignInFormProps {
  oauthProviders?: ("google" | "github" | "microsoft")[];
  callbackUrl?: string;
}

export default function SignInForm({
  oauthProviders = [],
  callbackUrl,
}: SignInFormProps) {
  const t = useTranslations("Auth.SignIn");
  const safeCallbackUrl = sanitizeCallbackUrl(callbackUrl);
  const isOidcFlow =
    safeCallbackUrl?.startsWith("/api/auth/oauth2/authorize") ?? false;
  const [usePassword, setUsePassword] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState<string | null>(null);
  const [seedPassword, setSeedPassword] = useState<Partial<SignInInput> | null>(
    null,
  );
  const [seedMagic, setSeedMagic] =
    useState<Partial<MagicLinkSignInInput> | null>(null);
  const [magicFormKey, setMagicFormKey] = useState(0);

  const passwordRef = useRef<SigninPasswordFormHandle>(null);
  const magicRef = useRef<SigninMagicLinkFormHandle>(null);

  function showPasswordFields() {
    const v = magicRef.current?.getValues();
    setSeedPassword(v ? { email: v.email, password: "" } : null);
    setUsePassword(true);
  }

  function hidePasswordFields() {
    const v = passwordRef.current?.getValues();
    setSeedMagic(v ? { email: v.email } : null);
    setUsePassword(false);
  }

  if (magicLinkEmail) {
    return (
      <div className="w-full space-y-6 animate-page-in">
        <MagicLinkCheckEmailHeader
          email={magicLinkEmail}
          isOidcFlow={isOidcFlow}
          namespace="Auth.SignIn"
        />

        <MagicLinkCodePanel
          email={magicLinkEmail}
          callbackUrl={safeCallbackUrl}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setMagicLinkEmail(null);
              setUsePassword(false);
              setSeedMagic(null);
              setMagicFormKey((k) => k + 1);
            }}
          >
            {t("checkEmail.tryAnother")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-page-in">
      <AuthPageHeader title={t("title")} description={t("description")} />

      {oauthProviders.length > 0 && (
        <SocialAuthButtons
          providers={oauthProviders}
          callbackURL={safeCallbackUrl}
        />
      )}

      {usePassword ? (
        <SigninPasswordForm
          ref={passwordRef}
          seedFromMagicLink={seedPassword}
          safeCallbackUrl={safeCallbackUrl}
        />
      ) : (
        <SigninMagicLinkForm
          key={magicFormKey}
          ref={magicRef}
          seedFromPassword={seedMagic}
          safeCallbackUrl={safeCallbackUrl}
          onMagicLinkSent={(email) => setMagicLinkEmail(email)}
        />
      )}

      <div className="flex flex-col gap-3 w-full">
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto justify-start px-0"
          onClick={usePassword ? hidePasswordFields : showPasswordFields}
        >
          {usePassword ? t("useMagicLink") : t("usePassword")}
        </Button>

        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between w-full">
          <p className="text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link
              href={buildAuthPageHref("/signup", safeCallbackUrl)}
              className="underline hover:text-foreground"
            >
              {t("register")}
            </Link>
          </p>
          {usePassword && (
            <Link
              href="/forgot-password"
              className="text-sm text-muted-foreground hover:underline"
            >
              {t("forgotPassword")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
