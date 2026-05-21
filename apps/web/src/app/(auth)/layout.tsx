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
        className="absolute inset-0 opacity-40 animate-grid-glide"
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
        <main className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center px-4 py-16 sm:px-6 sm:py-20">
          <div className="surface-panel mx-auto w-full max-w-form px-6 py-8 sm:px-8 sm:py-10">
            {children}
          </div>
        </main>
        <AuthFooter />
      </div>
    </div>
  );
}
