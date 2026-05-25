"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { SocialAuthButtons } from "@/auth/components/social-auth-buttons";
import { AuthPageHeader } from "@/components/auth-page-header";
import { Button } from "@/components/ui/button";
import { buildAuthPageHref } from "@/lib/auth/auth-page-callback-url";
import { sanitizeCallbackUrl } from "@/lib/auth/callback-url";
import type { MagicLinkSignUpInput, SignUpInput } from "@/lib/schemas";

import { MagicLinkCodePanel } from "../../components/magic-link-code-panel";
import {
  SignupMagicLinkForm,
  type SignupMagicLinkFormHandle,
} from "./signup-magic-link-form";
import {
  SignupPasswordForm,
  type SignupPasswordFormHandle,
} from "./signup-password-form";

interface SignUpFormProps {
  oauthProviders?: ("google" | "github" | "microsoft")[];
  callbackUrl?: string;
}

export default function SignUpForm({
  oauthProviders = [],
  callbackUrl,
}: SignUpFormProps) {
  const t = useTranslations("Auth.SignUp");
  const safeCallbackUrl = sanitizeCallbackUrl(callbackUrl);
  const isOidcFlow =
    safeCallbackUrl?.startsWith("/api/auth/oauth2/authorize") ?? false;
  const [usePassword, setUsePassword] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState<string | null>(null);
  const [seedPassword, setSeedPassword] = useState<Partial<SignUpInput> | null>(
    null,
  );
  const [seedMagic, setSeedMagic] =
    useState<Partial<MagicLinkSignUpInput> | null>(null);
  const [magicFormKey, setMagicFormKey] = useState(0);

  const passwordRef = useRef<SignupPasswordFormHandle>(null);
  const magicRef = useRef<SignupMagicLinkFormHandle>(null);

  function showPasswordFields() {
    const v = magicRef.current?.getValues();
    setSeedPassword(
      v
        ? { name: v.name, email: v.email, termsAccepted: v.termsAccepted }
        : null,
    );
    setUsePassword(true);
  }

  function hidePasswordFields() {
    const v = passwordRef.current?.getValues();
    setSeedMagic(
      v
        ? { name: v.name, email: v.email, termsAccepted: v.termsAccepted }
        : null,
    );
    setUsePassword(false);
  }

  if (magicLinkEmail) {
    return (
      <div className="w-full space-y-6 animate-page-in">
        <AuthPageHeader
          title={t("checkEmail.title")}
          description={t(
            isOidcFlow
              ? "checkEmail.oidcDescription"
              : "checkEmail.description",
            { email: magicLinkEmail },
          )}
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
        <SignupPasswordForm
          ref={passwordRef}
          seedFromMagicLink={seedPassword}
          safeCallbackUrl={safeCallbackUrl}
        />
      ) : (
        <SignupMagicLinkForm
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

        <p className="text-center text-sm text-muted-foreground">
          {t("hasAccount")}{" "}
          <Link
            href={buildAuthPageHref("/signin", safeCallbackUrl)}
            className="underline hover:text-foreground"
          >
            {t("login")}
          </Link>
        </p>
      </div>
    </div>
  );
}
