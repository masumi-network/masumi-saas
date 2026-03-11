import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

import { FooterSections } from "@/components/footer";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getAuthContext } from "@/lib/auth/utils";
import { OrganizationProvider } from "@/lib/context/organization-context";
import { PaymentNetworkProvider } from "@/lib/context/payment-network-context";
import type { PaymentNodeNetwork } from "@/lib/payment-node";

import { VerifyEmailBanner } from "./account/components/verify-email-banner";
import Header from "./components/header";
import Sidebar from "./components/sidebar";

export const dynamic = "force-dynamic";

function getInitialPaymentNetwork(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
): PaymentNodeNetwork {
  const value = cookieStore.get("payment_network")?.value;
  return value === "Mainnet" || value === "Preprod" ? value : "Preprod";
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authContext = await getAuthContext();

  if (!authContext.isAuthenticated || !authContext.session) {
    redirect("/signin");
  }

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const initialPaymentNetwork = getInitialPaymentNetwork(cookieStore);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <OrganizationProvider>
        <PaymentNetworkProvider initialNetwork={initialPaymentNetwork}>
          <SidebarProvider
            defaultOpen={defaultOpen}
            className="flex max-w-svw overflow-clip"
          >
            <Sidebar session={authContext.session} />
            <div className="flex min-w-0 flex-1 flex-col min-h-0">
              <Header />
              <div className="flex-1 min-h-0 overflow-y-auto">
                <main className="max-w-container mx-auto w-full relative min-h-main-content p-4">
                  {authContext.session.user.emailVerified !== true &&
                    authContext.session.user.email && (
                      <div className="mb-4">
                        <VerifyEmailBanner
                          email={authContext.session.user.email}
                        />
                      </div>
                    )}
                  {children}
                </main>
                <div className="max-w-container mx-auto w-full border-t border-border mt-4">
                  <FooterSections className="p-4" />
                </div>
              </div>
            </div>
          </SidebarProvider>
        </PaymentNetworkProvider>
      </OrganizationProvider>
    </NextIntlClientProvider>
  );
}
