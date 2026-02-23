"use client";

import { useTranslations } from "next-intl";

import { OrganizationSelect } from "@/components/organization-select";
import { Separator } from "@/components/ui/separator";
import { auth } from "@/lib/auth/auth";
import { useOrganizationContextOptional } from "@/lib/context/organization-context";

import { DeleteAccountForm } from "./delete-account-form";
import { EmailForm } from "./email-form";
import { NameForm } from "./name-form";
import { PasswordForm } from "./password-form";
import { TwoFactorSection } from "./two-factor-section";

type Account = Awaited<ReturnType<typeof auth.api.listUserAccounts>>[number];

function OrganizationSelectorSection() {
  const orgContext = useOrganizationContextOptional();
  if (!orgContext) return null;
  return (
    <div className="shrink-0">
      <OrganizationSelect />
    </div>
  );
}

interface AccountContentProps {
  accounts: Account[];
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
  userProfileCard: React.ReactNode;
}

export function AccountContent({
  accounts,
  user: _user,
  userProfileCard,
}: AccountContentProps) {
  const t = useTranslations("App.Account");

  const hasCredentialAccount = accounts.some(
    (account) => account.providerId === "credential",
  );

  return (
    <div className="w-full space-y-8">
      <div className="mx-auto max-w-3xl flex flex-row flex-wrap gap-4 items-center justify-between">
        <div className="space-y-2 min-w-0">
          <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm leading-6">
            {t("description")}
          </p>
        </div>
        <OrganizationSelectorSection />
      </div>

      <div className="mx-auto max-w-3xl space-y-8">
        {userProfileCard}

        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
          <NameForm />
          <EmailForm currentEmail={_user.email} />
          <div className="md:col-span-2">
            {hasCredentialAccount ? <PasswordForm /> : null}
          </div>
          <div className="md:col-span-2">
            {hasCredentialAccount ? <TwoFactorSection /> : null}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              {t("dangerZone")}
            </span>
            <Separator className="flex-1" />
          </div>
          <DeleteAccountForm />
        </div>
      </div>
    </div>
  );
}
