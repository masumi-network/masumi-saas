"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { SocialAuthButtons } from "@/auth/components/social-auth-buttons";
import { Button } from "@/components/ui/button";
import { sanitizeCallbackUrl } from "@/lib/auth/callback-url";
import type { MagicLinkSignInInput, SignInInput } from "@/lib/schemas";

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
      <div className="w-full max-w-form space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-light tracking-tight mb-4">
            {t("checkEmail.title")}
          </h1>
          <p className="text-sm text-muted-foreground mb-8 text-center max-w-md mx-auto">
            {t("checkEmail.description", { email: magicLinkEmail })}
          </p>
        </div>

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
          <Button variant="primary" asChild>
            <Link href="/signin">{t("login")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-form space-y-6">
      <div className="text-center">
        <h1 className="text-4xl font-light tracking-tight mb-4">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground text-center max-w-md mx-auto">
          {t("description")}
        </p>
      </div>

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
            <Link href="/signup" className="underline hover:text-foreground">
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
