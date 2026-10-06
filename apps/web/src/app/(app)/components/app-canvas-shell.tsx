"use client";

import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type AppCanvasShellProps = {
  children: React.ReactNode;
  className?: string;
};

export function AppCanvasShell({ children, className }: AppCanvasShellProps) {
  const pathname = usePathname();
  const isDashboardHome = pathname === "/";
  const isAccountPage = pathname === "/account";
  const showSubtleGlow = !isDashboardHome && !isAccountPage;
  const showVividGlow = isDashboardHome;

  return (
    <div
      className={cn(
        "relative flex min-h-svh min-w-0 flex-1 flex-col bg-background",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "app-canvas-glow-layer app-canvas-glow-subtle",
          showSubtleGlow ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "app-canvas-glow-layer app-canvas-glow-vivid",
          showVividGlow ? "opacity-100" : "opacity-0",
        )}
      />
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
        {children}
      </div>
    </div>
  );
}
