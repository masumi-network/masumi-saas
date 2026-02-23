"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { twoFactor } from "@/lib/auth/auth.client";

export default function TwoFactorForm() {
  const t = useTranslations("Auth.TwoFactor");
  const tErrors = useTranslations("Auth.Errors");
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    setIsLoading(true);
    try {
      if (useBackupCode) {
        const { data, error } = await twoFactor.verifyBackupCode({
          code: code.trim(),
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
          code: code.trim(),
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
      // Fallback: no data and no error (unexpected)
      toast.error(tErrors("UnexpectedError"));
    } catch {
      toast.error(tErrors("UnexpectedError"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-form space-y-6">
      <div className="text-center">
        <h1 className="text-4xl font-light tracking-tight mb-4">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground text-center max-w-md mx-auto">
          {useBackupCode ? t("backupCodeDescription") : t("description")}
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="flex flex-col items-center gap-4 w-full"
      >
        <div className="flex gap-4 items-center w-full">
          <label htmlFor="2fa-code" className="sr-only">
            {t("code")}
          </label>
          <Input
            id="2fa-code"
            ref={inputRef}
            type="text"
            inputMode={useBackupCode ? "text" : "numeric"}
            pattern={useBackupCode ? undefined : "[0-9]*"}
            maxLength={useBackupCode ? 20 : 6}
            placeholder={
              useBackupCode ? t("backupCodePlaceholder") : t("codePlaceholder")
            }
            autoComplete="one-time-code"
            autoFocus
            className="flex-1 bg-background text-center text-lg tracking-widest"
            value={code}
            onChange={(e) => setCode(e.target.value)}
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
      </form>

      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between w-full">
        <button
          type="button"
          onClick={() => {
            setUseBackupCode(!useBackupCode);
            setCode("");
            inputRef.current?.focus();
          }}
          className="text-sm text-muted-foreground hover:underline hover:text-foreground"
        >
          {useBackupCode ? t("useAuthenticator") : t("useBackupCode")}
        </button>
        <Link
          href="/signin"
          className="text-sm text-muted-foreground hover:underline hover:text-foreground"
        >
          {t("backToLogin")}
        </Link>
      </div>
    </div>
  );
}
