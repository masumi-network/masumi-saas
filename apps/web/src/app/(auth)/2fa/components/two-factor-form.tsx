"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { AuthPageHeader } from "@/components/auth-page-header";
import { OtpCodeInput } from "@/components/otp-code-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { twoFactor } from "@/lib/auth/auth.client";

export default function TwoFactorForm() {
  const t = useTranslations("Auth.TwoFactor");
  const tErrors = useTranslations("Auth.Errors");
  const router = useRouter();
  const labelId = useId();
  const [isLoading, setIsLoading] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [code, setCode] = useState("");
  const backupInputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e?: React.FormEvent, nextCode = code) {
    e?.preventDefault();
    if (!nextCode.trim()) return;

    setIsLoading(true);
    try {
      if (useBackupCode) {
        const { data, error } = await twoFactor.verifyBackupCode({
          code: nextCode.trim(),
        });
        if (error) {
          toast.error(error.message || tErrors("InvalidTwoFactorCode"));
          return;
        }
        if (data) {
          router.push("/");
          return;
        }
      } else {
        const { data, error } = await twoFactor.verifyTotp({
          code: nextCode.trim(),
        });
        if (error) {
          toast.error(error.message || tErrors("InvalidTwoFactorCode"));
          return;
        }
        if (data) {
          router.push("/");
          return;
        }
      }
      toast.error(tErrors("UnexpectedError"));
    } catch {
      toast.error(tErrors("UnexpectedError"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <AuthPageHeader
        title={t("title")}
        description={
          useBackupCode ? t("backupCodeDescription") : t("description")
        }
      />

      <form
        onSubmit={(event) => void onSubmit(event)}
        className="flex w-full flex-col items-center gap-4"
      >
        {useBackupCode ? (
          <div className="flex w-full items-center gap-4">
            <label htmlFor="2fa-backup-code" className="sr-only">
              {t("code")}
            </label>
            <Input
              id="2fa-backup-code"
              ref={backupInputRef}
              type="text"
              inputMode="text"
              maxLength={20}
              placeholder={t("backupCodePlaceholder")}
              autoComplete="one-time-code"
              autoFocus
              className="flex-1 bg-background text-center text-lg tracking-widest"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || !code.trim()}
              size="lg"
            >
              {isLoading ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  {t("submitting")}
                </>
              ) : (
                t("submit")
              )}
            </Button>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-4">
            <span id={labelId} className="sr-only">
              {t("code")}
            </span>
            <OtpCodeInput
              key="totp"
              value={code}
              onChange={setCode}
              onComplete={(completed) => void onSubmit(undefined, completed)}
              disabled={isLoading}
              autoFocus
              ariaLabelledBy={labelId}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || code.trim().length === 0}
              size="lg"
              className="w-full sm:w-auto"
            >
              {isLoading ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  {t("submitting")}
                </>
              ) : (
                t("submit")
              )}
            </Button>
          </div>
        )}
      </form>

      <div className="flex w-full flex-col items-center gap-2 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={() => {
            setUseBackupCode(!useBackupCode);
            setCode("");
            if (!useBackupCode) {
              setTimeout(() => backupInputRef.current?.focus(), 0);
            }
          }}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          {useBackupCode ? t("useAuthenticator") : t("useBackupCode")}
        </button>
        <Link
          href="/signin"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          {t("backToLogin")}
        </Link>
      </div>
    </div>
  );
}
