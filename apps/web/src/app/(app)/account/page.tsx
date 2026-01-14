import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";

import { AccountContent } from "./components/account-content";

export default async function AccountPage() {
  const requestHeaders = await headers();
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
      <AccountContent accounts={accounts} user={session.user} />
    </div>
  );
}
