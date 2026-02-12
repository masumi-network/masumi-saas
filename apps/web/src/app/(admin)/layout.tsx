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
      <div className="flex min-w-0 flex-1 flex-col overflow-clip">
        <AdminHeader />
        <main className="max-w-container mx-auto w-full relative min-h-main-content p-4">
          {children}
        </main>
        <div className="max-w-container mx-auto w-full">
          <FooterSections className="p-4" />
        </div>
      </div>
    </SidebarProvider>
  );
}
