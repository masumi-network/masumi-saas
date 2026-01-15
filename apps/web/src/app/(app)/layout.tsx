import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import MasumiLogo from "@/components/masumi-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { signOutAction } from "@/lib/actions/auth.action";
import { getAuthContext } from "@/lib/auth/utils";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authContext = await getAuthContext();
  const t = await getTranslations("Auth.SignOut");

  if (!authContext.isAuthenticated) {
    redirect("/signin");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="max-w-container mx-auto w-full h-14 px-4 flex items-center justify-between gap-4">
          <Link href="/">
            <MasumiLogo />
          </Link>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <form action={signOutAction}>
              <Button type="submit" variant="outline">
                {t("signOut")}
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-container mx-auto w-full px-4 py-8">
        <Suspense
          fallback={
            <Spinner
              size={24}
              addContainer
              containerClassName="min-h-[400px]"
            />
          }
        >
          {children}
        </Suspense>
      </main>
    </div>
  );
}
