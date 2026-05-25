import { GridPageBackground } from "@/components/grid-page-background";
import { cn } from "@/lib/utils";

type ErrorPageLayoutProps = {
  children: React.ReactNode;
  /** Covers the full viewport (auth/public routes). */
  variant?: "fullscreen" | "app";
};

export function ErrorPageLayout({
  children,
  variant = "fullscreen",
}: ErrorPageLayoutProps) {
  const isApp = variant === "app";

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-background p-6 text-foreground",
        isApp ? "fixed inset-0 z-40" : "relative min-h-svh",
      )}
    >
      <GridPageBackground />
      <div className="relative z-10 w-full max-w-lg">{children}</div>
    </div>
  );
}
