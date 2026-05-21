"use client";

import { useLocale, useTranslations } from "next-intl";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { OrganizationSelect } from "@/components/organization-select";
import { PageHeader } from "@/components/page-header";
import { ThemeSetting } from "@/components/theme-setting";
import { Separator } from "@/components/ui/separator";
import type { Locale } from "@/i18n/config";
import { auth } from "@/lib/auth/auth";
import { useOrganizationContextOptional } from "@/lib/context/organization-context";

import {
  ConnectedAppsSection,
  type SerializedConnectedClient,
} from "./connected-apps-section";
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
    emailVerified?: boolean;
  };
  connectedClients: SerializedConnectedClient[];
  userProfileCard: React.ReactNode;
}

export function AccountContent({
  accounts,
  user: _user,
  connectedClients,
  userProfileCard,
}: AccountContentProps) {
  const t = useTranslations("App.Account");
  const locale = useLocale() as Locale;

  const hasCredentialAccount = accounts.some(
    (account) => account.providerId === "credential",
  );

  return (
    <div className="w-full animate-page-in space-y-8">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={<OrganizationSelectorSection />}
        />
      </div>

      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex flex-row flex-nowrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
          <p className="min-w-0 shrink truncate pr-2 text-sm font-medium leading-none">
            {t("languageAndAppearance")}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeSetting />
            <LocaleSwitcher currentLocale={locale} />
          </div>
        </div>

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

        <ConnectedAppsSection clients={connectedClients} />

        <div className="flex flex-col gap-2 pt-8">
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
