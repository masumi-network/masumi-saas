import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { FooterSections } from "@/components/footer";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getAdminAuthContext } from "@/lib/auth/utils";

import AdminHeader from "./admin/components/header";
import AdminSidebar from "./admin/components/sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authContext = await getAdminAuthContext();

  // Not authenticated -> go to admin login
  if (!authContext.isAuthenticated || !authContext.session) {
    redirect("/admin/signin");
  }

  // Authenticated but not admin -> go to regular app
  if (!authContext.isAdmin) {
    redirect("/");
  }

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      className="flex max-w-svw overflow-clip"
    >
      <AdminSidebar session={authContext.session} />
      <div className="flex min-h-svh min-w-0 flex-1 flex-col overflow-clip bg-app-canvas">
        <AdminHeader />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <main className="relative mx-auto w-full max-w-container flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            {children}
          </main>
          <div className="mx-auto w-full max-w-container shrink-0 border-t border-border/80">
            <FooterSections className="px-4 py-6 sm:px-6 lg:px-8" />
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
