import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { FooterSections } from "@/components/footer";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getAuthContext } from "@/lib/auth/utils";

import Header from "./components/header";
import Sidebar from "./components/sidebar";

export const dynamic = "force-dynamic";

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

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      className="flex max-w-svw overflow-clip"
    >
      <Sidebar session={authContext.session} />
      <div className="flex min-w-0 flex-1 flex-col min-h-0">
        <Header />
        <div className="flex-1 min-h-0 overflow-y-auto">
          <main className="max-w-container mx-auto w-full relative min-h-main-content p-4">
            {children}
          </main>
          <div className="max-w-container mx-auto w-full">
            <FooterSections className="p-4" />
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
