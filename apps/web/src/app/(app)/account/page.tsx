import { auth } from "@/lib/auth/auth";
import { getRequestHeaders } from "@/lib/auth/utils";

import { KycStatusCard } from "../components/kyc-status-card";
import { AccountContent } from "./components/account-content";

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
        kycStatusCard={<KycStatusCard />}
      />
    </div>
  );
}
