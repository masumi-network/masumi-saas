import { redirect } from "next/navigation";

import gridSvg from "@/assets/grid.svg";
import { AuthFooter } from "@/components/auth-footer";
import { Header } from "@/components/header";
import { getAdminAuthContext } from "@/lib/auth/utils";

export const dynamic = "force-dynamic";

export default async function AdminAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authContext = await getAdminAuthContext();

  // Already authenticated admin -> go to admin dashboard
  if (authContext.isAuthenticated && authContext.isAdmin) {
    redirect("/admin");
  }

  // Authenticated but not admin -> go to regular app
  if (authContext.isAuthenticated && !authContext.isAdmin) {
    redirect("/");
  }

  // Not authenticated -> show login form
  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${typeof gridSvg === "string" ? gridSvg : gridSvg.src || gridSvg})`,
          backgroundRepeat: "repeat",
          backgroundSize: "auto",
        }}
      />
      <div className="relative z-10">
        <Header />
        <main className="flex flex-col items-center justify-center min-h-screen py-20 px-4 sm:px-6">
          {children}
        </main>
        <AuthFooter />
      </div>
    </div>
  );
}
