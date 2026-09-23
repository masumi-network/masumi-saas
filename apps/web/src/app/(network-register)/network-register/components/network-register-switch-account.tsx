"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { switchAccountAction } from "@/lib/actions/auth.action";

type NetworkRegisterSwitchAccountProps = {
  registrationEmail: string;
  signedInEmail: string;
  returnPath: string;
  backToRegistrationUrl: string;
};

export function NetworkRegisterSwitchAccount({
  registrationEmail,
  signedInEmail,
  returnPath,
  backToRegistrationUrl,
}: NetworkRegisterSwitchAccountProps) {
  const t = useTranslations("App.NetworkRegister");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">{t("wrongAccountTitle")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("wrongAccountDescription", {
            signedInEmail: signedInEmail || t("unknownSignedInEmail"),
            registrationEmail,
          })}
        </p>
      </div>

      <form
        action={(formData) => {
          startTransition(() => switchAccountAction(formData));
        }}
      >
        <input type="hidden" name="callbackUrl" value={returnPath} />
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Spinner size={16} className="mr-2" /> : null}
          {t("switchAccountButton", { registrationEmail })}
        </Button>
      </form>

      <Link
        href={backToRegistrationUrl}
        className="inline-block text-sm font-medium underline underline-offset-2"
      >
        {t("backToRegistration")}
      </Link>
    </div>
  );
}
