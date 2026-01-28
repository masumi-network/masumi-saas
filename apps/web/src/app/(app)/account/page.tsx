import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { auth } from "@/lib/auth/auth";
import { getRequestHeaders } from "@/lib/auth/utils";

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

  return (
    <div>
      <AccountContent
        accounts={accounts}
        user={session.user}
        userProfileCard={
          <Suspense fallback={<UserProfileCardSkeleton />}>
            <UserProfileCard />
          </Suspense>
        }
      />
    </div>
  );
}
