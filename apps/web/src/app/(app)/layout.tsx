import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

import { FooterSections } from "@/components/footer";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getBetterAuthInnerSession } from "@/lib/auth/session-types";
import { getAuthContext } from "@/lib/auth/utils";
import { authConfig } from "@/lib/config/auth.config";
import { NotificationsProvider } from "@/lib/context/notifications-context";
import { OrganizationProvider } from "@/lib/context/organization-context";
import { PaymentNetworkProvider } from "@/lib/context/payment-network-context";
import { RegistrationCompletionProvider } from "@/lib/context/registration-completion-context";
import type { PaymentNodeNetwork } from "@/lib/payment-node";

import { VerifyEmailBanner } from "./account/components/verify-email-banner";
import { AppCanvasShell } from "./components/app-canvas-shell";
import Header from "./components/header";
import { ImpersonationBanner } from "./components/impersonation-banner";
import Sidebar from "./components/sidebar";

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
  const innerSession = getBetterAuthInnerSession(authContext.session);
  const isImpersonating = Boolean(innerSession?.impersonatedBy);

  return (
    <NextIntlClientProvider messages={messages}>
      <OrganizationProvider>
        <PaymentNetworkProvider initialNetwork={initialPaymentNetwork}>
          <NotificationsProvider>
            <RegistrationCompletionProvider>
              <SidebarProvider
                defaultOpen={defaultOpen}
                className="flex max-w-svw overflow-clip"
              >
                <Sidebar session={authContext.session} />
                <AppCanvasShell>
                  <Header />
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                    <main className="relative mx-auto w-full max-w-container flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                      {isImpersonating && (
                        <div className="mb-4">
                          <ImpersonationBanner
                            activeUserName={authContext.session.user.name}
                            activeUserEmail={authContext.session.user.email}
                          />
                        </div>
                      )}
                      {authConfig.emailAndPassword.requireEmailVerification &&
                        authContext.session.user.emailVerified !== true &&
                        authContext.session.user.email && (
                          <div className="mb-4">
                            <VerifyEmailBanner
                              email={authContext.session.user.email}
                            />
                          </div>
                        )}
                      {children}
                    </main>
                    <div className="mx-auto w-full max-w-container shrink-0 border-t border-border/80">
                      <FooterSections className="px-4 py-6 sm:px-6 lg:px-8" />
                    </div>
                  </div>
                </AppCanvasShell>
              </SidebarProvider>
            </RegistrationCompletionProvider>
          </NotificationsProvider>
        </PaymentNetworkProvider>
      </OrganizationProvider>
    </NextIntlClientProvider>
  );
}
