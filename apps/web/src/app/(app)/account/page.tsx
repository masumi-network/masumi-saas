import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { auth } from "@/lib/auth/auth";
import { listConnectedOidcClients } from "@/lib/auth/connected-oidc-clients";
import { getRequestHeaders } from "@/lib/auth/utils";
import { isKycVerificationEnabled } from "@/lib/config/verification.config";

import {
  UserProfileCard,
  UserProfileCardSkeleton,
} from "../components/user-profile-card";
import { AccountContent } from "./components/account-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("App.Account");
  return {
    title: `Masumi - ${t("title")}`,
    description: t("description"),
  };
}

export default async function AccountPage() {
  const requestHeaders = await getRequestHeaders();
  const [accounts, session] = await Promise.all([
    auth.api.listUserAccounts({
      headers: requestHeaders,
    }),
    auth.api.getSession({
      headers: requestHeaders,
    }),
  ]);

  if (!session) {
    return null;
  }

  const connectedClients = await listConnectedOidcClients(session.user.id);
  const serializedConnectedClients = connectedClients.map((client) => ({
    ...client,
    lastTokenIssuedAt: client.lastTokenIssuedAt?.toISOString() ?? null,
    firstConnectedAt: client.firstConnectedAt?.toISOString() ?? null,
    lastConnectedAt: client.lastConnectedAt?.toISOString() ?? null,
  }));

  return (
    <div>
      <AccountContent
        accounts={accounts}
        user={session.user}
        connectedClients={serializedConnectedClients}
        userProfileCard={
          isKycVerificationEnabled() ? (
            <Suspense fallback={<UserProfileCardSkeleton />}>
              <UserProfileCard />
            </Suspense>
          ) : null
        }
      />
    </div>
  );
}
