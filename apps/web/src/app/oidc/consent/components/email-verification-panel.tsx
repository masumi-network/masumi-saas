"use client";

import { AlertCircle, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { emailOtp, sendVerificationEmail } from "@/lib/auth/auth.client";

const RESEND_COOLDOWN_SECONDS = 60;

function getAuthClientErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "";
  }

  const candidate = error as {
    message?: unknown;
    error?: { message?: unknown };
  };

  if (typeof candidate.message === "string") {
    return candidate.message.toLowerCase();
  }

  if (typeof candidate.error?.message === "string") {
    return candidate.error.message.toLowerCase();
  }

  return "";
}

interface EmailVerificationPanelProps {
  email: string;
  continueUrl?: string;
}

export function EmailVerificationPanel({
  email,
  continueUrl,
}: EmailVerificationPanelProps) {
  const t = useTranslations("Auth.OidcVerifyEmail");
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const id = setInterval(() => {
      setCooldownRemaining((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);

    return () => clearInterval(id);
  }, [cooldownRemaining]);

  function resolveOtpError(error: unknown): string {
    const message = getAuthClientErrorMessage(error);
    if (message.includes("expired")) {
      return t("expiredCode");
    }
    if (message.includes("too many")) {
      return t("tooManyAttempts");
    }
    if (message.includes("invalid otp")) {
      return t("invalidCode");
    }

    return t("genericError");
  }

  async function handleSendCode() {
    if (cooldownRemaining > 0) return;

    setInlineError(null);
    setIsSendingCode(true);
    try {
      const { error } = await emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      });

      if (error) {
        const message = resolveOtpError(error);
        setInlineError(message);
        toast.error(message);
        return;
      }

      setCooldownRemaining(RESEND_COOLDOWN_SECONDS);
      toast.success(t("resendCodeSuccess"));
    } catch (error) {
      const message = resolveOtpError(error);
      setInlineError(message);
      toast.error(message);
    } finally {
      setIsSendingCode(false);
    }
  }

  async function handleSendLink() {
    if (cooldownRemaining > 0) return;

    setInlineError(null);
    setIsSendingLink(true);
    try {
      const { error } = await sendVerificationEmail({
        email,
        ...(continueUrl ? { callbackURL: continueUrl } : {}),
      });

      if (error) {
        setInlineError(t("resendLinkError"));
        toast.error(t("resendLinkError"));
        return;
      }

      setCooldownRemaining(RESEND_COOLDOWN_SECONDS);
      toast.success(t("resendLinkSuccess"));
    } catch {
      setInlineError(t("resendLinkError"));
      toast.error(t("resendLinkError"));
    } finally {
      setIsSendingLink(false);
    }
  }

  async function handleVerify() {
    if (!otp.trim()) {
      setInlineError(t("invalidCode"));
      return;
    }

    setInlineError(null);
    setIsVerifying(true);
    try {
      const { error } = await emailOtp.verifyEmail({
        email,
        otp: otp.trim(),
      });

      if (error) {
        const message = resolveOtpError(error);
        setInlineError(message);
        toast.error(message);
        return;
      }

      toast.success(t("verified"));
      router.refresh();
    } catch (error) {
      const message = resolveOtpError(error);
      setInlineError(message);
      toast.error(message);
    } finally {
      setIsVerifying(false);
    }
  }

  const sendDisabled =
    cooldownRemaining > 0 || isSendingCode || isSendingLink || isVerifying;

  return (
    <div className="space-y-4 rounded-lg border border-amber-400/20 bg-amber-500/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
          <Mail className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("title")}</p>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="oidc-email-verification-code"
          className="text-sm font-medium"
        >
          {t("codeLabel")}
        </label>
        <Input
          id="oidc-email-verification-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder={t("codePlaceholder")}
          value={otp}
          maxLength={6}
          className="text-center font-mono text-lg tracking-widest"
          onChange={(event) =>
            setOtp(event.target.value.replace(/\D+/g, "").slice(0, 6))
          }
        />
      </div>

      {inlineError ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{inlineError}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          variant="primary"
          onClick={handleVerify}
          disabled={isVerifying || otp.trim().length === 0}
          className="sm:flex-1"
        >
          {isVerifying ? <Spinner size={14} className="mr-2" /> : null}
          {isVerifying ? t("submitting") : t("submit")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleSendCode}
          disabled={sendDisabled}
          className="sm:flex-1"
        >
          {isSendingCode ? <Spinner size={14} className="mr-2" /> : null}
          {cooldownRemaining > 0
            ? t("resendIn", { seconds: cooldownRemaining })
            : t("resendCode")}
        </Button>
      </div>

      <Button
        type="button"
        variant="link"
        className="h-auto px-0 text-xs"
        disabled={sendDisabled}
        onClick={handleSendLink}
      >
        {isSendingLink ? <Spinner size={14} className="mr-2" /> : null}
        {t("resendLink")}
      </Button>
    </div>
  );
}
