import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import gridSvg from "@/assets/grid.svg";
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
  const cookieStore = await cookies();
  const hasOidcLoginPrompt = cookieStore.has("oidc_login_prompt");

  if (authContext.isAuthenticated && !hasOidcLoginPrompt) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <div
        className="absolute inset-0 opacity-25 animate-grid-glide"
        style={{
          backgroundImage: `url(${typeof gridSvg === "string" ? gridSvg : gridSvg.src || gridSvg})`,
          backgroundRepeat: "repeat",
          backgroundSize: "auto",
          backgroundPosition: "center",
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 25%, black 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 25%, black 70%)",
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
