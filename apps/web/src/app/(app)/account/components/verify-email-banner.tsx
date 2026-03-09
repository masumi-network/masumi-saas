"use client";

import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { sendVerificationEmail } from "@/lib/auth/auth.client";

const RESEND_COOLDOWN_SECONDS = 60;

interface VerifyEmailBannerProps {
  email: string | null;
}

export function VerifyEmailBanner({ email }: VerifyEmailBannerProps) {
  const t = useTranslations("App.Account.verifyEmailBanner");
  const [isSending, setIsSending] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const id = setInterval(() => {
      setCooldownRemaining((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownRemaining]);

  const handleResend = async () => {
    if (!email || cooldownRemaining > 0) return;
    setIsSending(true);
    try {
      const { error } = await sendVerificationEmail({
        email,
        callbackURL: "/account",
      });
      if (error) {
        toast.error(t("resendError"));
      } else {
        toast.success(t("resendSuccess"));
        setCooldownRemaining(RESEND_COOLDOWN_SECONDS);
      }
    } catch {
      toast.error(t("resendError"));
    } finally {
      setIsSending(false);
    }
  };

  const isDisabled = isSending || cooldownRemaining > 0;

  return (
    <Card className="rounded-lg border-amber-500/15 bg-amber-500/5 shadow-none">
      <CardHeader>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <Mail className="h-4 w-4 shrink-0" />
              {t("title")}
            </CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResend}
            disabled={isDisabled}
            className="shrink-0 border-amber-500/30 bg-background hover:bg-amber-500/10"
          >
            {isSending ? <Spinner size={14} className="mr-2" /> : null}
            {cooldownRemaining > 0
              ? t("resendIn", { seconds: cooldownRemaining })
              : t("resendButton")}
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}
