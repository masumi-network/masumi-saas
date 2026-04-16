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
    <div className="min-h-screen bg-background text-foreground relative">
      <div
        className="absolute inset-0 opacity-25 animate-grid-glide pointer-events-none"
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
        <div className="flex-1">{children}</div>
        <AuthFooter />
      </div>
    </div>
  );
}
