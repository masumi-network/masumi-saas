import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/utils";
import { ThemeToggle } from "@/components/theme-toggle";

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
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-end">
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center py-12">
        {children}
      </main>
    </div>
  );
}

