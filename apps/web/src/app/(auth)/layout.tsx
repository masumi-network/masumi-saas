import { redirect } from "next/navigation";

import { AuthFooter } from "@/components/auth-footer";
import { Header } from "@/components/header";
import { getAuthContext } from "@/lib/auth/utils";

export const dynamic = "force-dynamic";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authContext = await getAuthContext();

  if (authContext.isAuthenticated) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex flex-col items-center justify-center min-h-screen py-20 px-4 sm:px-6">
        {children}
      </main>
      <AuthFooter />
    </div>
  );
}
