import "./globals.css";

import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import CookieConsent from "@/components/cookie-consent";
import { GlobalModalsContextProvider } from "@/components/modals/global-modals-context";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { appMono, appSans } from "@/lib/fonts";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export async function generateMetadata(): Promise<Metadata> {
  const metadata: Metadata = {
    title: "Masumi",
    description: "Masumi Platform",
    icons: {
      icon: "/assets/logo.png",
      shortcut: "/assets/logo.png",
      apple: "/assets/logo.png",
    },
  };

  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    metadata.other = {
      ...Sentry.getTraceData(),
    };
  }

  return metadata;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${appSans.variable} ${appMono.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          <NextIntlClientProvider messages={messages}>
            <QueryProvider>
              <GlobalModalsContextProvider>
                {children}
              </GlobalModalsContextProvider>
            </QueryProvider>
            <Toaster />
            <CookieConsent />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
