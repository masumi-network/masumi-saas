"use client";

import { useTranslations } from "next-intl";

import { auth } from "@/lib/auth/auth";

import { DeleteAccountForm } from "./delete-account-form";
import { NameForm } from "./name-form";
import { PasswordForm } from "./password-form";

type Account = Awaited<ReturnType<typeof auth.api.listUserAccounts>>[number];

interface AccountContentProps {
  accounts: Account[];
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

export function AccountContent({ accounts, user: _user }: AccountContentProps) {
  const t = useTranslations("App.Account");

  const hasCredentialAccount = accounts.some(
    (account) => account.providerId === "credential",
  );

  return (
    <div className="w-full space-y-12 px-2">
      <div className="space-y-2">
        <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm leading-6">
          {t("description")}
        </p>
      </div>

      <div className="max-w-3xl space-y-8">
        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
          <NameForm />
          <div className="md:col-span-2">
            {hasCredentialAccount ? <PasswordForm /> : null}
          </div>
        </div>

        <div className="border-t pt-8">
          <div className="mx-auto w-full">
            <DeleteAccountForm />
          </div>
        </div>
      </div>
    </div>
  );
}
