import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/utils";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { MobileBlocker } from "@/components/mobile-blocker";

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
    <MobileBlocker>
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="flex flex-col items-center justify-center min-h-screen py-20">
          {children}
        </main>
        <Footer />
      </div>
    </MobileBlocker>
  );
}
