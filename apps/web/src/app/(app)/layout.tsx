import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getAuthContext } from "@/lib/auth/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { signOutAction } from "@/lib/actions/auth.action";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authContext = await getAuthContext();

  if (!authContext.isAuthenticated) {
    redirect("/signin");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="text-lg font-semibold">
            Masumi SaaS
          </Link>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <form action={signOutAction}>
              <Button type="submit" variant="outline">
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 container py-8">
        <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
      </main>
    </div>
  );
}

