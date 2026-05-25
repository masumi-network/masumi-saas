import gridSvg from "@/assets/grid.svg";
import { AuthFooter } from "@/components/auth-footer";
import { Header } from "@/components/header";

export const dynamic = "force-dynamic";

export default function OidcLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-app-canvas text-foreground">
      <div
        className="absolute inset-0 opacity-40 animate-grid-glide pointer-events-none"
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
      <div className="relative z-10 flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-14">
          <div className="w-full max-w-lg animate-page-in">{children}</div>
        </main>
        <AuthFooter />
      </div>
    </div>
  );
}
