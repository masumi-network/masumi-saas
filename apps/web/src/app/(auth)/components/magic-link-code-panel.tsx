"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { signInMagicLinkCodeAction } from "@/lib/actions/auth.action";

interface MagicLinkCodePanelProps {
  email: string;
  callbackUrl?: string;
}

export function MagicLinkCodePanel({
  email,
  callbackUrl,
}: MagicLinkCodePanelProps) {
  const t = useTranslations("Auth.MagicLinkCode");
  const tErrors = useTranslations("Auth.Errors");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!otp.trim()) {
      setInlineError(tErrors("InvalidMagicLinkCode"));
      return;
    }

    setIsLoading(true);
    setInlineError(null);

    try {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("otp", otp.trim());

      const result = await signInMagicLinkCodeAction(formData, callbackUrl);
      if ("error" in result) {
        const message =
          (result.errorKey ? tErrors(result.errorKey) : undefined) ??
          result.error ??
          tErrors("UnexpectedError");
        setInlineError(message);
        toast.error(message);
        return;
      }

      toast.success(t("success"));
      window.location.assign(result.redirectTo ?? "/");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : tErrors("UnexpectedError");
      setInlineError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-form space-y-3 rounded-lg border border-border/70 bg-muted/30 p-4">
      <div className="space-y-1 text-center">
        <p className="text-sm font-medium">{t("title")}</p>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="magic-link-code" className="text-sm font-medium">
          {t("codeLabel")}
        </label>
        <Input
          id="magic-link-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder={t("codePlaceholder")}
          value={otp}
          maxLength={6}
          onChange={(event) =>
            setOtp(event.target.value.replace(/\D+/g, "").slice(0, 6))
          }
        />
      </div>

      {inlineError ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {inlineError}
        </div>
      ) : null}

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={handleSubmit}
        disabled={isLoading || otp.trim().length === 0}
      >
        {isLoading ? <Spinner size={14} className="mr-2" /> : null}
        {isLoading ? t("submitting") : t("submit")}
      </Button>
    </div>
  );
}
